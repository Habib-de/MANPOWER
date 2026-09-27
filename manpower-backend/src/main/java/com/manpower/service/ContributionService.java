package com.manpower.service;

import com.manpower.entity.Contribution;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface ContributionService {
    
    Contribution saveContribution(Contribution contribution);
    
    List<Contribution> getAllContributions();
    
    Optional<Contribution> getContributionById(String id);
    
    List<Contribution> getContributionsByMemberId(String memberId);
    
    List<Contribution> getContributionsByGroupId(String groupId);
    
    void deleteContribution(String id);
    
    Map<String, Object> getContributionSummary(String groupId);
    
    BigDecimal getTotalContributionsByGroup(String groupId);
    
    // ✅ ADD THIS LINE
    Contribution updateContribution(String id, Map<String, Object> updates);
}