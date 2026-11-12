package com.manpower.service;

import com.manpower.dto.GroupSettingsDTO;
import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.entity.Contribution;
import com.manpower.enums.MemberRole;
import com.manpower.enums.MemberStatus;
import com.manpower.enums.TransactionType;
import com.manpower.enums.TransactionStatus;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.MemberRepository;
import com.manpower.repository.ContributionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class GroupServiceImp implements GroupService {

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private MemberRepository memberRepository;
    
    @Autowired
    private ContributionRepository contributionRepository;

    // ========== EXISTING METHODS ==========
    
    @Override
    public List<Group> getAllGroups() {
        return groupRepository.findAll();
    }

    @Override
    public Optional<Group> getGroupById(String id) {
        return groupRepository.findById(id);
    }

    @Override
    public Group saveGroup(Group group) {
        Member creator = memberRepository.findById(group.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("❌ Creator not found: " + group.getCreatedBy()));

        if (creator.getRole() != MemberRole.GroupAdmin && creator.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can create groups");
        }

        return groupRepository.save(group);
    }

    @Override
    public void deleteGroup(String id) {
        groupRepository.deleteById(id);
    }

    @Override
    public List<Group> getGroupsByCreator(String creatorId) {
        Member creator = memberRepository.findById(creatorId)
                .orElseThrow(() -> new RuntimeException("❌ Creator not found: " + creatorId));

        if (creator.getRole() != MemberRole.GroupAdmin && creator.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can view their groups");
        }

        return groupRepository.findByCreatedBy(creatorId);
    }

    @Override
    public Group terminateGroup(String id) {
        Group group = groupRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + id));

        group.setStatus("Terminated");
        return groupRepository.save(group);
    }
    
    // ========== MPESA METHODS ==========
    
    @Override
    @Transactional
    public Group configureGroupMpesa(String groupId, 
                                    String consumerKey, 
                                    String consumerSecret, 
                                    String businessShortcode, 
                                    String passkey, 
                                    String callbackUrl) {
        
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
        
        Member admin = memberRepository.findById(group.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("❌ Admin not found for group"));
                
        if (admin.getRole() != MemberRole.GroupAdmin && admin.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can configure MPESA");
        }
        
        group.setMpesaConsumerKey(consumerKey);
        group.setMpesaConsumerSecret(consumerSecret);
        group.setMpesaBusinessShortcode(businessShortcode);
        group.setMpesaPasskey(passkey);
        group.setMpesaCallbackUrl(callbackUrl);
        group.setMpesaIsActive(true);
        group.setMpesaLastConfigured(LocalDateTime.now());
        
        return groupRepository.save(group);
    }
    
    @Override
    @Transactional
    public Group toggleGroupMpesa(String groupId, boolean isActive) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
        
        Member admin = memberRepository.findById(group.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("❌ Admin not found for group"));
                
        if (admin.getRole() != MemberRole.GroupAdmin && admin.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can toggle MPESA");
        }
        
        group.setMpesaIsActive(isActive);
        if (isActive) {
            group.setMpesaLastConfigured(LocalDateTime.now());
        }
        
        return groupRepository.save(group);
    }
    
    @Override
    public Optional<Group> getGroupWithActiveMpesa(String groupId) {
        return groupRepository.findByIdAndMpesaIsActiveTrue(groupId);
    }
    
    @Override
    public List<Group> getAllGroupsWithActiveMpesa() {
        return groupRepository.findByMpesaIsActiveTrue();
    }
    
    @Override
    @Transactional
    public Group updateMpesaCallbackUrl(String groupId, String callbackUrl) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
        
        Member admin = memberRepository.findById(group.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("❌ Admin not found for group"));
                
        if (admin.getRole() != MemberRole.GroupAdmin && admin.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can update callback URL");
        }
        
        group.setMpesaCallbackUrl(callbackUrl);
        group.setMpesaLastConfigured(LocalDateTime.now());
        
        return groupRepository.save(group);
    }
    
    // ========== NEW CONTRIBUTION SETTINGS METHODS ==========
    
    @Override
    @Transactional
    public Group updateGroupSettings(String groupId, GroupSettingsDTO settingsDTO, String adminId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
        
        Member admin = memberRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("❌ Admin not found"));
        
        boolean isSuperAdmin = admin.getRole() == MemberRole.SuperAdmin;
        boolean isGroupCreator = group.getCreatedBy().equals(adminId);
        
        if (!isSuperAdmin && !isGroupCreator) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can update group settings");
        }
        
        if (settingsDTO.getContributionFrequency() != null) {
            group.setContributionFrequency(settingsDTO.getContributionFrequency());
        }
        
        if (settingsDTO.getExpectedContributionAmount() != null) {
            group.setExpectedContributionAmount(settingsDTO.getExpectedContributionAmount());
        }
        
        if (settingsDTO.getEnablePenalty() != null) {
            group.setEnablePenalty(settingsDTO.getEnablePenalty());
        }
        
        if (settingsDTO.getPenaltyAmount() != null) {
            group.setPenaltyAmount(settingsDTO.getPenaltyAmount());
        }
        
        if (settingsDTO.getGracePeriodDays() != null) {
            group.setGracePeriodDays(settingsDTO.getGracePeriodDays());
        }
        
        if (settingsDTO.getEnableReminders() != null) {
            group.setEnableReminders(settingsDTO.getEnableReminders());
        }
        
        if (settingsDTO.getReminderDaysBefore() != null) {
            group.setReminderDaysBefore(settingsDTO.getReminderDaysBefore());
        }
        
        if (settingsDTO.getContributionDueDay() != null) {
            group.setContributionDueDay(settingsDTO.getContributionDueDay());
        }
        
        if (group.getContributionFrequency() != null && group.getContributionDueDay() != null) {
            LocalDate nextDate = calculateNextDueDate(group);
            group.setNextContributionDate(nextDate);
        }
        
        Group savedGroup = groupRepository.save(group);
        
        if (settingsDTO.getExpectedContributionAmount() != null ||
            settingsDTO.getContributionFrequency() != null ||
            settingsDTO.getContributionDueDay() != null) {
            generatePendingContributions(groupId);
        }
        
        return savedGroup;
    }
    
    @Override
    public GroupSettingsDTO getGroupSettings(String groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
        
        GroupSettingsDTO dto = new GroupSettingsDTO();
        dto.setContributionFrequency(group.getContributionFrequency());
        dto.setExpectedContributionAmount(group.getExpectedContributionAmount());
        dto.setEnablePenalty(group.getEnablePenalty());
        dto.setPenaltyAmount(group.getPenaltyAmount());
        dto.setGracePeriodDays(group.getGracePeriodDays());
        dto.setEnableReminders(group.getEnableReminders());
        dto.setReminderDaysBefore(group.getReminderDaysBefore());
        dto.setContributionDueDay(group.getContributionDueDay());
        
        return dto;
    }
    
    @Override
@Transactional
public void generatePendingContributions(String groupId) {
    Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
    
    if (group.getContributionFrequency() == null || group.getExpectedContributionAmount() == null) {
        return;
    }
    
    List<Member> members = memberRepository.findByGroupId(groupId);
    List<Member> activeMembers = members.stream()
            .filter(m -> m.getStatus() == MemberStatus.Active)
            .collect(Collectors.toList());
    
    if (activeMembers.isEmpty()) {
        return;
    }
    
    LocalDate dueDate = group.getNextContributionDate();
    if (dueDate == null) {
        dueDate = calculateNextDueDate(group);
        group.setNextContributionDate(dueDate);
        groupRepository.save(group);
    }
    
    // ========== HANDLES BOTH WEEKLY AND MONTHLY ==========
    LocalDate contributionPeriod;
    if (group.getContributionFrequency() == Group.ContributionFrequency.WEEKLY) {
        // WEEKLY: Use Monday of the week as period identifier
        contributionPeriod = dueDate.with(DayOfWeek.MONDAY);
    } else {
        // MONTHLY: Use first day of the month as period identifier
        contributionPeriod = dueDate.withDayOfMonth(1);
    }
    // =====================================================
    
    for (Member member : activeMembers) {
        // Check if contribution already exists for this period
        List<Contribution> existing = contributionRepository.findByContributionPeriodAndGroupId(contributionPeriod, groupId);
        boolean alreadyExists = existing.stream().anyMatch(c -> c.getMember().getId().equals(member.getId()));
        
        if (!alreadyExists) {
            Contribution contribution = new Contribution();
            contribution.setMember(member);
            contribution.setGroup(group);
            contribution.setTransactionType(TransactionType.Contribution);
            contribution.setAmount(group.getExpectedContributionAmount());
            contribution.setDueDate(dueDate);
            contribution.setContributionPeriod(contributionPeriod);
            contribution.setStatus(TransactionStatus.Pending);
            contribution.setPaymentMethod("Pending");
            contribution.setIsLate(false);
            contribution.setDaysLate(0);
            contribution.setPenaltyApplied(BigDecimal.ZERO);
            contribution.setReminderSent(false);
            contribution.setPenaltyProcessed(false);
            contribution.setCreatedBy(group.getCreatedBy());
            contribution.setModifiedBy(group.getCreatedBy());
            contribution.setMansoftTenantId(group.getMansoftTenantId());
            contribution.setTransactionDate(dueDate);
            
            contributionRepository.save(contribution);
        }
    }
    
    LocalDate nextDate = calculateNextDueDate(group);
    group.setNextContributionDate(nextDate);
    groupRepository.save(group);
}
    
    @Override
    public LocalDate calculateNextDueDate(Group group) {
        LocalDate today = LocalDate.now();
        int dueDay = group.getContributionDueDay() != null ? group.getContributionDueDay() : 1;
        
        if (group.getContributionFrequency() == Group.ContributionFrequency.MONTHLY) {
            LocalDate candidate = LocalDate.of(today.getYear(), today.getMonth(), Math.min(dueDay, today.lengthOfMonth()));
            
            if (candidate.isBefore(today) || candidate.equals(today)) {
                candidate = candidate.plusMonths(1);
                candidate = LocalDate.of(candidate.getYear(), candidate.getMonth(), 
                                        Math.min(dueDay, candidate.lengthOfMonth()));
            }
            return candidate;
            
        } else if (group.getContributionFrequency() == Group.ContributionFrequency.WEEKLY) {
            DayOfWeek targetDay = DayOfWeek.of(dueDay);
            LocalDate candidate = today.with(TemporalAdjusters.nextOrSame(targetDay));
            return candidate;
        }
        
        return today.plusDays(7);
    }
}