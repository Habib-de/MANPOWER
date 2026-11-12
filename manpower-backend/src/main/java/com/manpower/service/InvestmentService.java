package com.manpower.service;

import com.manpower.entity.Investment;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface InvestmentService {
    
    // Basic CRUD operations
    Investment createInvestment(Investment investment);
    List<Investment> getAllInvestments();
    Optional<Investment> getInvestmentById(String id);
    Investment updateInvestment(String id, Investment investment);
    void deleteInvestment(String id);
    
    // Business logic operations
    List<Investment> getInvestmentsByGroup(String groupId);
    List<Investment> getInvestmentsByStatus(Investment.InvestmentStatus status);
    List<Investment> getInvestmentsByType(Investment.InvestmentType type);
    List<Investment> getInvestmentsByGroupAndStatus(String groupId, Investment.InvestmentStatus status);
    
    // Financial calculations
    BigDecimal getTotalInvestedAmountByGroup(String groupId);
    BigDecimal getGroupInvestmentPortfolioValue(String groupId);
    
    // Investment management
    Investment updateInvestmentStatus(String investmentId, Investment.InvestmentStatus newStatus);
    Investment updateCurrentValue(String investmentId, BigDecimal newValue);
    
    // Analytics
    List<Investment> getInvestmentsNearingMaturity(int daysThreshold);
}