package com.manpower.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
//import java.util.Map;

@Data
public class LoanDecisionResponse {
    
    // Basic info
    private String memberId;
    private Double loanAmountRequested;
    private String loanReason;
    
    // ML Decision results
    private String finalRecommendation; // APPROVE, REJECT, APPROVE_WITH_CAUTION
    private Double finalConfidence;
    private String decisionReasoning;
    
    // Eligibility details
    private Double eligibilityAmount;
    private Double eligibilityConfidence;
    
    // Risk assessment
    private String loanRisk; // VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH
    private Double riskProbability;
    private Double riskConfidence;
    
    // Sentiment analysis
    private String sentimentRisk; // LOW, MEDIUM, HIGH
    private Double sentimentConfidence;
    
    // Member insights
    private String memberStatus;
    private String memberRole;
    private Double membershipMonths;
    
    // Metadata
    private LocalDateTime processedAt;
    private String dataSource;
    private String mlOrchestratorVersion;
    
    // ✅ CRITICAL FIX: Add this field to store the decision log ID
    private Long decisionLogId;
    
    // ✅ NEW: Add these fields for detailed explanations
    private DetailedExplanations detailedExplanations;
    private DecisionTable decisionTable;
    private String htmlDecisionTable;
    
    // Success flags
    private Boolean success;
    private String errorMessage;
    
    // Constructor for success
    public LoanDecisionResponse(String memberId, String finalRecommendation, 
                               Double finalConfidence, String decisionReasoning) {
        this.memberId = memberId;
        this.finalRecommendation = finalRecommendation;
        this.finalConfidence = finalConfidence;
        this.decisionReasoning = decisionReasoning;
        this.success = true;
    }
    
    // Constructor for error
    public LoanDecisionResponse(String memberId, String errorMessage) {
        this.memberId = memberId;
        this.errorMessage = errorMessage;
        this.success = false;
        this.finalRecommendation = "ERROR";
        this.finalConfidence = 0.0;
    }
    
    // Default constructor
    public LoanDecisionResponse() {}
    
    // ============== INNER CLASSES FOR DETAILED EXPLANATIONS ==============
    
    @Data
    public static class DetailedExplanations {
        private String memberId;
        private List<Explanation> explanations;
        private DecisionSummary summary;
    }
    
    @Data
    public static class Explanation {
        private String category;
        private String decision;
        private String reason;
        private String keyFactor;
        private String impact;
    }
    
    @Data 
    public static class DecisionSummary {
        private String keyRecommendation;
        private String primaryReason;
        private String interestRateJustification;
        private String confidenceLevel;
    }
    
    @Data
    public static class DecisionTable {
        private List<InterestRateComponent> interestRateBreakdown;
        private List<EligibilityFactor> eligibilityFactors;
        private List<RiskAssessment> riskAssessment;
        private List<Recommendation> recommendations;
        private String summary;
    }
    
    @Data
    public static class InterestRateComponent {
        private String component;
        private String value;
        private String reason;
    }
    
    @Data
    public static class EligibilityFactor {
        private String factor;
        private String status;
        private String impact;
    }
    
    @Data
    public static class RiskAssessment {
        private String riskCategory;
        private String level;
        private String score;
    }
    
    @Data
    public static class Recommendation {
        private String action;
        private String status;
        private String details;
    }
}