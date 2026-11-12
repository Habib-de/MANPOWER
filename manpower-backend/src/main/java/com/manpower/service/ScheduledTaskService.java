package com.manpower.service;

import com.manpower.entity.Contribution;
import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.enums.MemberStatus;
import com.manpower.enums.TransactionStatus;
import com.manpower.repository.ContributionRepository;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ScheduledTaskService {

    @Autowired
    private ContributionRepository contributionRepository;
    
    @Autowired
    private GroupRepository groupRepository;
    
    @Autowired
    private MemberRepository memberRepository;
    
    @Autowired
    private GroupService groupService;
    
    /**
     * Run daily at 8:00 AM - Send reminders for contributions due in the next X days
     */
    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void sendContributionReminders() {
        System.out.println("🕐 Running scheduled task: Sending contribution reminders...");
        
        // Get all groups that have reminders enabled
        List<Group> groupsWithReminders = groupRepository.findAllGroupsWithRemindersEnabled();
        
        for (Group group : groupsWithReminders) {
            int reminderDays = group.getReminderDaysBefore() != null ? group.getReminderDaysBefore() : 2;
            LocalDate startDate = LocalDate.now();
            LocalDate endDate = startDate.plusDays(reminderDays);
            
            // Find contributions due in the reminder window that haven't had reminders sent
            List<Contribution> dueContributions = contributionRepository.findByDueDateBetweenAndReminderSentFalse(startDate, endDate);
            
            for (Contribution contribution : dueContributions) {
                Member member = contribution.getMember();
                
                // Skip if member is not active
                if (member.getStatus() != MemberStatus.Active) {
                    continue;
                }
                
                // Send reminder (print to console - replace with actual email/SMS service)
                System.out.println("📧 REMINDER: " + member.getFirstName() + " " + member.getLastName() +
                                 " - Contribution of KES " + contribution.getAmount() +
                                 " due on " + contribution.getDueDate() +
                                 " for group: " + group.getGroupName());
                
                // Mark reminder as sent
                contribution.setReminderSent(true);
                contribution.setReminderSentDate(LocalDateTime.now());
                contributionRepository.save(contribution);
            }
        }
        
        System.out.println("✅ Reminder task completed");
    }
    
    /**
     * Run daily at 1:00 AM - Check for late contributions and apply penalties
     */
    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void checkAndApplyPenalties() {
        System.out.println("🕐 Running scheduled task: Checking for late contributions and applying penalties...");
        
        LocalDate today = LocalDate.now();
        
        // Find all contributions with due date before today that are not marked as late
        List<Contribution> overdueContributions = contributionRepository.findOverdueContributions(today);
        
        for (Contribution contribution : overdueContributions) {
            Group group = contribution.getGroup();
            
            // Check if penalties are enabled for this group
            if (group.getEnablePenalty() != null && group.getEnablePenalty()) {
                int daysLate = (int) java.time.temporal.ChronoUnit.DAYS.between(contribution.getDueDate(), today);
                int gracePeriod = group.getGracePeriodDays() != null ? group.getGracePeriodDays() : 3;
                
                // Apply penalty only after grace period
                if (daysLate > gracePeriod) {
                    BigDecimal penaltyAmount = group.getPenaltyAmount() != null ? group.getPenaltyAmount() : BigDecimal.ZERO;
                    
                    contribution.setIsLate(true);
                    contribution.setDaysLate(daysLate);
                    contribution.setPenaltyApplied(penaltyAmount);
                    contribution.setPenaltyProcessed(true);
                    contribution.setAmount(contribution.getAmount().add(penaltyAmount));
                    
                    System.out.println("⚠️ PENALTY APPLIED: Member " + contribution.getMember().getFirstName() +
                                     " - Late by " + daysLate + " days, Penalty: KES " + penaltyAmount);
                } else {
                    contribution.setIsLate(true);
                    contribution.setDaysLate(daysLate);
                }
                
                contributionRepository.save(contribution);
            } else {
                // Just mark as late without penalty
                contribution.setIsLate(true);
                int daysLate = (int) java.time.temporal.ChronoUnit.DAYS.between(contribution.getDueDate(), today);
                contribution.setDaysLate(daysLate);
                contributionRepository.save(contribution);
            }
        }
        
        // Also process contributions that need penalty (late but penalty not applied yet)
        List<Contribution> needsPenalty = contributionRepository.findContributionsNeedingPenalty(today);
        for (Contribution contribution : needsPenalty) {
            Group group = contribution.getGroup();
            if (group.getEnablePenalty() != null && group.getEnablePenalty()) {
                BigDecimal penaltyAmount = group.getPenaltyAmount() != null ? group.getPenaltyAmount() : BigDecimal.ZERO;
                int daysLate = (int) java.time.temporal.ChronoUnit.DAYS.between(contribution.getDueDate(), today);
                
                contribution.setPenaltyApplied(penaltyAmount);
                contribution.setPenaltyProcessed(true);
                contribution.setDaysLate(daysLate);
                contribution.setAmount(contribution.getAmount().add(penaltyAmount));
                contributionRepository.save(contribution);
                
                System.out.println("⚠️ PENALTY APPLIED (late): Member " + contribution.getMember().getFirstName() +
                                 " - Penalty: KES " + penaltyAmount);
            }
        }
        
        System.out.println("✅ Penalty check completed");
    }
    
    /**
     * Run every Monday at 9:00 AM - Send warnings to group admins about members with multiple late contributions
     */
    @Scheduled(cron = "0 0 9 * * MON")
    @Transactional
    public void sendAdminWarnings() {
        System.out.println("🕐 Running scheduled task: Sending admin warnings...");
        
        LocalDate today = LocalDate.now();
        
        // Get all groups with contribution settings
        List<Group> groupsWithSettings = groupRepository.findAllGroupsWithContributionSettings();
        
        for (Group group : groupsWithSettings) {
            // Find members with 2 or more late contributions
            List<Object[]> defaultingMembers = contributionRepository.findMembersWithMultipleLateContributions(
                group.getId(), today, 2);
            
            if (!defaultingMembers.isEmpty()) {
                // Get the group admin (creator)
                Member admin = memberRepository.findById(group.getCreatedBy()).orElse(null);
                
                if (admin != null) {
                    System.out.println("⚠️ ADMIN WARNING for " + admin.getEmail() + 
                                     " - Group: " + group.getGroupName() +
                                     " has " + defaultingMembers.size() + " members with multiple late contributions");
                    
                    // Print details of defaulting members
                    for (Object[] memberData : defaultingMembers) {
                        String memberId = (String) memberData[0];
                        Long lateCount = (Long) memberData[1];
                        
                        Member defaultingMember = memberRepository.findById(memberId).orElse(null);
                        if (defaultingMember != null) {
                            System.out.println("   - " + defaultingMember.getFirstName() + " " + defaultingMember.getLastName() +
                                             " has " + lateCount + " late contributions");
                        }
                    }
                }
            }
        }
        
        System.out.println("✅ Admin warning task completed");
    }
    
    /**
     * Run daily at 2:00 AM - Generate new pending contributions for groups with schedules
     */
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void generateScheduledContributions() {
        System.out.println("🕐 Running scheduled task: Generating pending contributions...");
        
        // Get all groups that have contribution settings
        List<Group> groupsWithSettings = groupRepository.findAllGroupsWithContributionSettings();
        
        for (Group group : groupsWithSettings) {
            // Check if next contribution date is today or before today
            if (group.getNextContributionDate() != null && 
                !group.getNextContributionDate().isAfter(LocalDate.now())) {
                
                System.out.println("📝 Generating contributions for group: " + group.getGroupName());
                groupService.generatePendingContributions(group.getId());
            }
        }
        
        System.out.println("✅ Contribution generation task completed");
    }
}