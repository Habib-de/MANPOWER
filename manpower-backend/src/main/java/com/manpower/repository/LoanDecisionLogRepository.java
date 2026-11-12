package com.manpower.repository;

import com.manpower.entity.LoanDecisionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanDecisionLogRepository extends JpaRepository<LoanDecisionLog, Long> {
    
    // Find latest decision for a member
    Optional<LoanDecisionLog> findTopByMemberIdOrderByCreatedAtDesc(String memberId);
    
    // Find all decisions for a member (for history)
    List<LoanDecisionLog> findByMemberIdOrderByCreatedAtDesc(String memberId);
    
    // Find decisions by recommendation type
    List<LoanDecisionLog> findByFinalRecommendationOrderByCreatedAtDesc(String recommendation);
    
    // Find unused decisions (not yet converted to loans)
    List<LoanDecisionLog> findByUsedInLoanCreationFalse();
    
    // Statistics query
    @Query("SELECT l.finalRecommendation, COUNT(l) FROM LoanDecisionLog l GROUP BY l.finalRecommendation")
    List<Object[]> countDecisionsByRecommendation();
}