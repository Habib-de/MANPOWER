package com.manpower.repository;

import com.manpower.entity.Investment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvestmentRepository extends JpaRepository<Investment, String> {
    
    // Find all investments by group ID
    List<Investment> findByGroupId(String groupId);
    
    // Find investments by status
    List<Investment> findByStatus(Investment.InvestmentStatus status);
    
    // Find investments by group ID and status
    List<Investment> findByGroupIdAndStatus(String groupId, Investment.InvestmentStatus status);
    
    // Find investments by type
    List<Investment> findByInvestmentType(Investment.InvestmentType investmentType);
    
    // Calculate total invested amount by group
    @Query("SELECT SUM(i.amountInvested) FROM Investment i WHERE i.group.id = :groupId")
    Optional<BigDecimal> getTotalInvestedAmountByGroup(@Param("groupId") String groupId);
    
    // Find active investments with maturity date approaching (for notifications)
    @Query("SELECT i FROM Investment i WHERE i.status = 'ACTIVE' AND i.maturityDate BETWEEN CURRENT_DATE AND :futureDate")
    List<Investment> findInvestmentsNearingMaturity(@Param("futureDate") Date futureDate);
}