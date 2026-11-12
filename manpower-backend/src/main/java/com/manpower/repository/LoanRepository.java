package com.manpower.repository;
import com.manpower.entity.Member;
import com.manpower.entity.Loan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface LoanRepository extends JpaRepository<Loan, String> {
    // ============ CRITICAL FOR LOAN REPAYMENTS - ADD THIS ============
    // Find active loans by member and status list (for repayments)
    List<Loan> findByMemberAndStatusIn(Member member, List<String> statuses);

    
    
    // ============ EXISTING QUERIES (Keep these if you have them) ============
    
    // ============ NEW ML-INTEGRATION QUERIES ============
    
    // Find loans by ML decision log ID
    Optional<Loan> findByMlDecisionLogId(Long mlDecisionLogId);
    
    // Find all ML-approved loans
    List<Loan> findByIsMlApprovedTrue();
    
    // Find ML-approved loans by member
    List<Loan> findByMemberIdAndIsMlApprovedTrue(String memberId);
    
    // Find loans by ML recommendation type
    List<Loan> findByMlRecommendation(String mlRecommendation);
    
    // Find loans by ML risk level
    List<Loan> findByMlRiskLevel(String riskLevel);
    
    // Find high-confidence ML approvals (confidence > 0.7)
    @Query("SELECT l FROM Loan l WHERE l.mlConfidenceScore > 0.7 AND l.isMlApproved = true")
    List<Loan> findHighConfidenceMlLoans();
    
    // Count ML-approved vs non-ML loans
    @Query("SELECT l.isMlApproved, COUNT(l) FROM Loan l GROUP BY l.isMlApproved")
    List<Object[]> countLoansByMlApproval();
    
    // Get ML approval statistics by risk level
    @Query("SELECT l.mlRiskLevel, COUNT(l) FROM Loan l WHERE l.isMlApproved = true GROUP BY l.mlRiskLevel")
    List<Object[]> countMlApprovedLoansByRiskLevel();
    
    // Find latest ML-approved loan for a member
    @Query("SELECT l FROM Loan l WHERE l.member.id = ?1 AND l.isMlApproved = true ORDER BY l.createdOn DESC")
    List<Loan> findLatestMlApprovedLoansByMember(String memberId);
    
    // Check if member has any ML-approved loans
    @Query("SELECT COUNT(l) > 0 FROM Loan l WHERE l.member.id = ?1 AND l.isMlApproved = true")
    boolean hasMlApprovedLoans(String memberId);
    
    // Find loans that used ML but weren't approved by ML (for analysis)
    @Query("SELECT l FROM Loan l WHERE l.mlDecisionLogId IS NOT NULL AND l.isMlApproved = false")
    List<Loan> findLoansWithMlRejection();
    
    // Performance monitoring: Find ML-approved loans with high default rate
    @Query("SELECT l FROM Loan l WHERE l.isMlApproved = true AND l.mlRiskLevel IN ('HIGH', 'VERY_HIGH') AND l.outstandingBalance > 0")
    List<Loan> findHighRiskMlLoansWithOutstandingBalance();

    // ============ GUARANTOR QUERIES ============
    
    // Find all loans where a member is the guarantor (for capacity calculation)
    List<Loan> findByGuarantorIdAndStatusIn(String guarantorId, List<String> statuses);
    
    // Calculate total guarantee amount a member is currently liable for
    @Query("SELECT COALESCE(SUM(l.guarantorAmount), 0) FROM Loan l WHERE l.guarantor.id = ?1 AND l.status IN ('PENDING_GUARANTOR', 'APPROVED', 'ACTIVE', 'PENDING', 'OVERDUE')")
    BigDecimal getTotalGuaranteeAmountByGuarantorId(String guarantorId);
}