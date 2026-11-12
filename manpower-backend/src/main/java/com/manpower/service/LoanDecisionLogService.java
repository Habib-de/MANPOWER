package com.manpower.service;

import com.manpower.dto.LoanAssessmentRequest;
import com.manpower.dto.LoanDecisionResponse;
import com.manpower.entity.LoanDecisionLog;
import com.manpower.repository.LoanDecisionLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoanDecisionLogService {
    
    private final LoanDecisionLogRepository loanDecisionLogRepository;
    private final ObjectMapper objectMapper;
    
    public LoanDecisionLog logDecision(LoanAssessmentRequest request, LoanDecisionResponse response) {
        try {
            LoanDecisionLog decisionLog = LoanDecisionLog.builder()
                .memberId(request.getMemberId())
                .requestedAmount(request.getLoanAmount())
                .loanReason(request.getLoanReason())
                .finalRecommendation(response.getFinalRecommendation())
                .finalConfidence(response.getFinalConfidence())
                .eligibilityAmount(response.getEligibilityAmount())
                .eligibilityConfidence(response.getEligibilityConfidence())
                .loanRisk(response.getLoanRisk())
                .riskProbability(response.getRiskProbability())
                .riskConfidence(response.getRiskConfidence())
                .sentimentRisk(response.getSentimentRisk())
                .sentimentConfidence(response.getSentimentConfidence())
                .decisionReasoning(response.getDecisionReasoning())
                .memberStatus(request.getMemberStatus())
                .memberRole(request.getMemberRole())
                .membershipMonths(response.getMembershipMonths())
                .dataSource(response.getDataSource())
                .mlOrchestratorVersion("1.0")
                .rawMlResponse(convertResponseToJson(response))
                .usedInLoanCreation(false)
                .build();
            
            LoanDecisionLog savedLog = loanDecisionLogRepository.save(decisionLog);
            log.info("✅ Decision logged for member {} with ID: {}", request.getMemberId(), savedLog.getId());
            
            return savedLog;
            
        } catch (Exception e) {
            log.error("❌ Failed to log decision for member {}: {}", request.getMemberId(), e.getMessage());
            throw new RuntimeException("Failed to log decision", e);
        }
    }
    
    private String convertResponseToJson(LoanDecisionResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize ML response to JSON: {}", e.getMessage());
            return "Serialization failed";
        }
    }
    
    public Map<String, Object> getDecisionStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        try {
            // Total decisions
            long totalDecisions = loanDecisionLogRepository.count();
            stats.put("totalDecisions", totalDecisions);
            
            // Decisions by recommendation type
            List<Object[]> recommendationCounts = loanDecisionLogRepository.countDecisionsByRecommendation();
            Map<String, Long> decisionsByType = new HashMap<>();
            
            for (Object[] result : recommendationCounts) {
                decisionsByType.put((String) result[0], (Long) result[1]);
            }
            stats.put("decisionsByType", decisionsByType);
            
            // Unused decisions
            List<LoanDecisionLog> unusedDecisions = loanDecisionLogRepository.findByUsedInLoanCreationFalse();
            stats.put("unusedDecisions", unusedDecisions.size());
            
            // Recent decisions (last 10)
            List<LoanDecisionLog> recentDecisions = loanDecisionLogRepository.findAll();
            if (recentDecisions.size() > 10) {
                recentDecisions = recentDecisions.subList(0, 10);
            }
            stats.put("recentDecisions", recentDecisions);
            
        } catch (Exception e) {
            log.error("Error generating decision statistics: {}", e.getMessage());
            stats.put("error", "Failed to generate statistics");
        }
        
        return stats;
    }
    
    public void markDecisionAsUsed(Long decisionLogId) {
        try {
            LoanDecisionLog decisionLog = loanDecisionLogRepository.findById(decisionLogId)
                .orElseThrow(() -> new RuntimeException("Decision log not found: " + decisionLogId));
            
            decisionLog.setUsedInLoanCreation(true);
            loanDecisionLogRepository.save(decisionLog);
            
            log.info("✅ Decision log {} marked as used in loan creation", decisionLogId);
            
        } catch (Exception e) {
            log.error("❌ Failed to mark decision log {} as used: {}", decisionLogId, e.getMessage());
            throw new RuntimeException("Failed to mark decision as used", e);
        }
    }
    
    public Optional<LoanDecisionLog> getLatestDecisionForMember(String memberId) {
        return loanDecisionLogRepository.findTopByMemberIdOrderByCreatedAtDesc(memberId);
    }
}