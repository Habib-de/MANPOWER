package com.manpower.repository;

import com.manpower.entity.Contribution;
import com.manpower.entity.Member;
import com.manpower.enums.TransactionType;
import com.manpower.enums.TransactionStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ContributionRepository extends JpaRepository<Contribution, String> {

    // ========== EXISTING METHODS ==========
    
    List<Contribution> findByMember(Member member);

    List<Contribution> findByMemberId(String memberId);

    List<Contribution> findByGroupId(String groupId);

    List<Contribution> findByVolunteerCampaignId(String campaignId);

    List<Contribution> findByMemberIdAndTransactionType(String memberId, TransactionType transactionType);

    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.group.id = :groupId")
    BigDecimal sumByGroupId(@Param("groupId") String groupId);

    @Query("SELECT COALESCE(SUM(c.amount), 0), COUNT(DISTINCT c.member.id), COUNT(c.id) " +
           "FROM Contribution c WHERE c.volunteerCampaign.id = :campaignId AND c.status = 'Completed'")
    Object[] getVolunteerCampaignStats(@Param("campaignId") String campaignId);

    // ========== NEW METHODS FOR CONTRIBUTION SCHEDULING & PENALTIES ==========
    
    // Find contributions by due date range for reminders
    @Query("SELECT c FROM Contribution c WHERE c.dueDate BETWEEN :startDate AND :endDate AND c.reminderSent = false AND c.status = 'Completed'")
    List<Contribution> findByDueDateBetweenAndReminderSentFalse(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
    
    // Find late contributions that haven't had penalties applied yet
    @Query("SELECT c FROM Contribution c WHERE c.dueDate < :currentDate AND c.isLate = false AND c.penaltyProcessed = false AND c.status = 'Completed'")
    List<Contribution> findLateContributionsNotProcessed(@Param("currentDate") LocalDate currentDate);
    
    // Find all pending contributions for a group with due date
    @Query("SELECT c FROM Contribution c WHERE c.group.id = :groupId AND c.status = 'Completed' AND c.dueDate IS NOT NULL")
    List<Contribution> findPendingContributionsByGroupId(@Param("groupId") String groupId);
    
    // Find contributions that are due today
    @Query("SELECT c FROM Contribution c WHERE c.dueDate = :today AND c.status = 'Completed' AND c.reminderSent = false")
    List<Contribution> findContributionsDueToday(@Param("today") LocalDate today);
    
    // Find contributions that are overdue (past due date)
    @Query("SELECT c FROM Contribution c WHERE c.dueDate < :today AND c.status = 'Pending' AND c.isLate = false")
    List<Contribution> findOverdueContributions(@Param("today") LocalDate today);
    
    // Find members with multiple pending/late contributions (for admin warnings)
    @Query("SELECT c.member.id, COUNT(c) FROM Contribution c WHERE c.group.id = :groupId AND c.dueDate < :today AND c.status = 'Completed' AND c.paymentDate IS NULL GROUP BY c.member.id HAVING COUNT(c) >= :threshold")
    List<Object[]> findMembersWithMultipleLateContributions(@Param("groupId") String groupId, @Param("today") LocalDate today, @Param("threshold") int threshold);
    
    // Get contribution summary for a group (total expected, total paid, total pending, total penalties)
    @Query("SELECT " +
           "COUNT(c) as totalContributions, " +
           "SUM(CASE WHEN c.paymentDate IS NOT NULL THEN c.amount ELSE 0 END) as totalPaid, " +
           "SUM(CASE WHEN c.paymentDate IS NULL THEN c.amount ELSE 0 END) as totalPending, " +
           "SUM(c.penaltyApplied) as totalPenalties " +
           "FROM Contribution c WHERE c.group.id = :groupId AND c.transactionType = 'Contribution'")
    Object[] getContributionSummaryByGroupId(@Param("groupId") String groupId);
    
    // Find contributions by group and date range
    List<Contribution> findByGroupIdAndDueDateBetween(String groupId, LocalDate startDate, LocalDate endDate);
    
    // Find contributions by member and status
    List<Contribution> findByMemberIdAndStatus(String memberId, TransactionStatus status);
    
    // Find all contributions for a specific period
    @Query("SELECT c FROM Contribution c WHERE c.contributionPeriod = :period AND c.group.id = :groupId")
    List<Contribution> findByContributionPeriodAndGroupId(@Param("period") LocalDate period, @Param("groupId") String groupId);
    
    // Count late contributions for a member
    @Query("SELECT COUNT(c) FROM Contribution c WHERE c.member.id = :memberId AND c.isLate = true AND c.status = 'Completed'")
    int countLateContributionsByMemberId(@Param("memberId") String memberId);
    
    // Find contributions that need penalty processing (late but penalty not applied)
    @Query("SELECT c FROM Contribution c WHERE c.dueDate < :currentDate AND c.penaltyApplied = 0 AND c.penaltyProcessed = false AND c.group.enablePenalty = true AND c.status = 'Pending'")
    List<Contribution> findContributionsNeedingPenalty(@Param("currentDate") LocalDate currentDate);

    // ✅ ADD THIS NEW METHOD - Get contributions for a specific date range (for financial year)
    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.member.id = :memberId AND c.transactionType = 'Contribution' AND c.status = 'Completed' AND c.transactionDate BETWEEN :startDate AND :endDate")
    BigDecimal getTotalContributionsByMemberIdAndDateRange(@Param("memberId") String memberId, @Param("startDate") java.time.LocalDate startDate, @Param("endDate") java.time.LocalDate endDate);

    // Add this method - it's used by LoanService for guarantor calculations
    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.member.id = :memberId AND c.transactionType = 'Contribution' AND c.status = 'Completed'")
    BigDecimal getTotalContributionsByMemberId(@Param("memberId") String memberId);
}