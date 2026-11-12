package com.manpower.service;

import com.manpower.entity.Investment;
import com.manpower.repository.InvestmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class InvestmentServiceImpl implements InvestmentService {

    @Autowired
    private InvestmentRepository investmentRepository;

    @Override
    public Investment createInvestment(Investment investment) {
        // Generate ID if not provided
        if (investment.getId() == null || investment.getId().trim().isEmpty()) {
            investment.setId(UUID.randomUUID().toString());
        }
        
        // Set default values if not provided
        if (investment.getCurrentValue() == null) {
            investment.setCurrentValue(investment.getAmountInvested());
        }
        
        // Calculate actual return rate for new investments (0% initially)
        if (investment.getAmountInvested() != null && investment.getCurrentValue() != null) {
            BigDecimal returnAmount = investment.getCurrentValue().subtract(investment.getAmountInvested());
            BigDecimal returnRate = returnAmount.divide(investment.getAmountInvested(), 4, BigDecimal.ROUND_HALF_UP)
                                              .multiply(BigDecimal.valueOf(100));
            investment.setActualReturnRate(returnRate);
        }
        
        // Set created timestamp
        investment.setCreatedOn(new Date());
        investment.setModifiedOn(new Date());
        
        return investmentRepository.save(investment);
    }

    @Override
    public List<Investment> getAllInvestments() {
        return investmentRepository.findAll();
    }

    @Override
    public Optional<Investment> getInvestmentById(String id) {
        return investmentRepository.findById(id);
    }

    @Override
    public Investment updateInvestment(String id, Investment investment) {
        Optional<Investment> existingInvestment = investmentRepository.findById(id);
        if (existingInvestment.isPresent()) {
            Investment updatedInvestment = existingInvestment.get();
            
            // Update fields
            updatedInvestment.setInvestmentName(investment.getInvestmentName());
            updatedInvestment.setInvestmentType(investment.getInvestmentType());
            updatedInvestment.setAmountInvested(investment.getAmountInvested());
            updatedInvestment.setCurrentValue(investment.getCurrentValue());
            updatedInvestment.setInvestmentDate(investment.getInvestmentDate());
            updatedInvestment.setMaturityDate(investment.getMaturityDate());
            updatedInvestment.setExpectedReturnRate(investment.getExpectedReturnRate());
            updatedInvestment.setRiskLevel(investment.getRiskLevel());
            updatedInvestment.setStatus(investment.getStatus());
            updatedInvestment.setDescription(investment.getDescription());
            updatedInvestment.setModifiedOn(new Date());
            updatedInvestment.setModifiedBy(investment.getModifiedBy());
            
            // Recalculate return rate when updating
            if (updatedInvestment.getAmountInvested() != null && updatedInvestment.getCurrentValue() != null) {
                BigDecimal returnAmount = updatedInvestment.getCurrentValue().subtract(updatedInvestment.getAmountInvested());
                BigDecimal returnRate = returnAmount.divide(updatedInvestment.getAmountInvested(), 4, BigDecimal.ROUND_HALF_UP)
                                                  .multiply(BigDecimal.valueOf(100));
                updatedInvestment.setActualReturnRate(returnRate);
            }
            
            return investmentRepository.save(updatedInvestment);
        }
        throw new RuntimeException("Investment not found with id: " + id);
    }

    @Override
    public void deleteInvestment(String id) {
        investmentRepository.deleteById(id);
    }

    @Override
    public List<Investment> getInvestmentsByGroup(String groupId) {
        return investmentRepository.findByGroupId(groupId);
    }

    @Override
    public List<Investment> getInvestmentsByStatus(Investment.InvestmentStatus status) {
        return investmentRepository.findByStatus(status);
    }

    @Override
    public List<Investment> getInvestmentsByType(Investment.InvestmentType type) {
        return investmentRepository.findByInvestmentType(type);
    }

    @Override
    public List<Investment> getInvestmentsByGroupAndStatus(String groupId, Investment.InvestmentStatus status) {
        return investmentRepository.findByGroupIdAndStatus(groupId, status);
    }

    @Override
    public BigDecimal getTotalInvestedAmountByGroup(String groupId) {
        return investmentRepository.getTotalInvestedAmountByGroup(groupId)
                .orElse(BigDecimal.ZERO);
    }

    @Override
    public BigDecimal getGroupInvestmentPortfolioValue(String groupId) {
        List<Investment> investments = investmentRepository.findByGroupId(groupId);
        return investments.stream()
                .map(inv -> inv.getCurrentValue() != null ? inv.getCurrentValue() : inv.getAmountInvested())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Override
    public Investment updateInvestmentStatus(String investmentId, Investment.InvestmentStatus newStatus) {
        Optional<Investment> investmentOpt = investmentRepository.findById(investmentId);
        if (investmentOpt.isPresent()) {
            Investment investment = investmentOpt.get();
            investment.setStatus(newStatus);
            investment.setModifiedOn(new Date());
            return investmentRepository.save(investment);
        }
        throw new RuntimeException("Investment not found with id: " + investmentId);
    }

    @Override
    public Investment updateCurrentValue(String investmentId, BigDecimal newValue) {
        Optional<Investment> investmentOpt = investmentRepository.findById(investmentId);
        if (investmentOpt.isPresent()) {
            Investment investment = investmentOpt.get();
            investment.setCurrentValue(newValue);
            investment.setModifiedOn(new Date());
            
            // Calculate actual return rate
            if (investment.getAmountInvested() != null && investment.getAmountInvested().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal returnAmount = newValue.subtract(investment.getAmountInvested());
                BigDecimal returnRate = returnAmount.divide(investment.getAmountInvested(), 4, BigDecimal.ROUND_HALF_UP)
                                                  .multiply(BigDecimal.valueOf(100));
                investment.setActualReturnRate(returnRate);
            }
            
            return investmentRepository.save(investment);
        }
        throw new RuntimeException("Investment not found with id: " + investmentId);
    }

    @Override
    public List<Investment> getInvestmentsNearingMaturity(int daysThreshold) {
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.DAY_OF_YEAR, daysThreshold);
        Date futureDate = calendar.getTime();
        return investmentRepository.findInvestmentsNearingMaturity(futureDate);
    }
}