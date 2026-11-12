package com.manpower.service;

import com.manpower.dto.LoanAssessmentRequest;
import com.manpower.dto.LoanDecisionResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.core.ParameterizedTypeReference;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class MLIntegrationService {
    
    private final RestTemplate restTemplate;
    private final String mlOrchestratorUrl = "http://localhost:5000/api/v1/loan_decision";
    
    public MLIntegrationService(RestTemplateBuilder restTemplateBuilder) {
        this.restTemplate = restTemplateBuilder
            .setConnectTimeout(Duration.ofSeconds(10))
            .setReadTimeout(Duration.ofSeconds(30))
            .build();
    }
    
    public LoanDecisionResponse getLoanDecision(LoanAssessmentRequest request) {
        try {
            log.info("🔍 Calling ML orchestrator for member: {}", request.getMemberId());
            
            // Prepare request for ML orchestrator
            Map<String, Object> requestBody = new HashMap<>();
            Map<String, Object> memberProfile = new HashMap<>();
            
            memberProfile.put("id", request.getMemberId());
            memberProfile.put("status", request.getMemberStatus());
            memberProfile.put("role", request.getMemberRole());
            memberProfile.put("joinDate", request.getJoinDate());
            
            requestBody.put("memberProfile", memberProfile);
            requestBody.put("loanAmount", request.getLoanAmount());
            requestBody.put("loanReason", request.getLoanReason());
            
            // Set headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            
            // Call ML orchestrator using ParameterizedTypeReference to preserve generics
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                mlOrchestratorUrl,
                HttpMethod.POST,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return mapToLoanDecisionResponse(response.getBody(), request.getMemberId());
            } else {
                log.error("ML orchestrator returned non-OK status: {}", response.getStatusCode());
                return createFallbackDecision(request, "ML service returned error status");
            }
            
        } catch (Exception e) {
            log.error("❌ Failed to get ML decision for member {}: {}", 
                request.getMemberId(), e.getMessage());
            
            return createFallbackDecision(request, "ML service unavailable: " + e.getMessage());
        }
    }
    
    private LoanDecisionResponse mapToLoanDecisionResponse(Map<String, Object> mlResponse, String memberId) {
        LoanDecisionResponse response = new LoanDecisionResponse();
        response.setMemberId(memberId);
        response.setSuccess(true);
        
        try {
            // Map basic fields
            response.setFinalRecommendation(safeGetString(mlResponse, "final_recommendation"));
            response.setFinalConfidence(convertToDouble(mlResponse.get("final_confidence")));
            response.setDecisionReasoning(safeGetString(mlResponse, "decision_reasoning"));
            
            // Map eligibility
            response.setEligibilityAmount(convertToDouble(mlResponse.get("eligibility_amount")));
            response.setEligibilityConfidence(convertToDouble(mlResponse.get("eligibility_confidence")));
            
            // Map risk
            response.setLoanRisk(safeGetString(mlResponse, "loan_risk"));
            response.setRiskProbability(convertToDouble(mlResponse.get("risk_probability")));
            response.setRiskConfidence(convertToDouble(mlResponse.get("risk_confidence")));
            
            // Map sentiment
            response.setSentimentRisk(safeGetString(mlResponse, "sentiment_risk"));
            response.setSentimentConfidence(convertToDouble(mlResponse.get("sentiment_confidence")));
            
            // Map member insights
            response.setMemberStatus(safeGetString(mlResponse, "member_status"));
            response.setMemberRole(safeGetString(mlResponse, "member_role"));
            response.setMembershipMonths(convertToDouble(mlResponse.get("membership_months")));
            
            // Map metadata
            response.setDataSource(safeGetString(mlResponse, "data_source"));
            response.setLoanAmountRequested(convertToDouble(mlResponse.get("loan_amount_requested")));
            response.setLoanReason(safeGetString(mlResponse, "loan_reason"));
            
            // Map ML version
            response.setMlOrchestratorVersion(safeGetString(mlResponse, "ml_orchestrator_version"));
            
            // Map processed timestamp
            try {
                String processedAtStr = safeGetString(mlResponse, "processed_at");
                if (processedAtStr != null && !processedAtStr.isEmpty()) {
                    LocalDateTime processedAt = LocalDateTime.parse(
                        processedAtStr.replace("Z", ""),
                        DateTimeFormatter.ISO_LOCAL_DATE_TIME
                    );
                    response.setProcessedAt(processedAt);
                } else {
                    response.setProcessedAt(LocalDateTime.now());
                }
            } catch (Exception e) {
                log.warn("Could not parse processed_at timestamp: {}", e.getMessage());
                response.setProcessedAt(LocalDateTime.now());
            }
            
            // ✅ CRITICAL: MAP DETAILED EXPLANATIONS
            mapDetailedExplanations(mlResponse, response);
            
            // ✅ MAP DECISION TABLE
            mapDecisionTable(mlResponse, response);
            
            // ✅ MAP HTML DECISION TABLE
            mapHtmlDecisionTable(mlResponse, response);
            
            log.info("✅ ML decision mapped successfully for member: {}", memberId);
            log.info("✅ Detailed explanations mapped: {}", 
                response.getDetailedExplanations() != null);
            log.info("✅ Decision table mapped: {}", 
                response.getDecisionTable() != null);
            
        } catch (Exception e) {
            log.error("Error mapping ML response for member {}: {}", memberId, e.getMessage());
            response.setSuccess(false);
            response.setErrorMessage("Error processing ML response: " + e.getMessage());
        }
        
        return response;
    }
    
    @SuppressWarnings("unchecked")
    private void mapDetailedExplanations(Map<String, Object> mlResponse, LoanDecisionResponse response) {
        try {
            if (mlResponse.containsKey("detailed_explanations")) {
                Object explanationsObj = mlResponse.get("detailed_explanations");
                if (explanationsObj instanceof Map) {
                    Map<String, Object> explanationsMap = (Map<String, Object>) explanationsObj;
                    
                    LoanDecisionResponse.DetailedExplanations detailedExplanations = 
                        new LoanDecisionResponse.DetailedExplanations();
                    
                    // Set member ID
                    detailedExplanations.setMemberId(safeGetString(explanationsMap, "member_id"));
                    
                    // Map explanations list
                    if (explanationsMap.containsKey("explanations")) {
                        Object explanationsListObj = explanationsMap.get("explanations");
                        if (explanationsListObj instanceof List) {
                            List<Map<String, Object>> explanationsList = (List<Map<String, Object>>) explanationsListObj;
                            
                            List<LoanDecisionResponse.Explanation> explanations = explanationsList.stream()
                                .map(exp -> {
                                    LoanDecisionResponse.Explanation explanation = 
                                        new LoanDecisionResponse.Explanation();
                                    explanation.setCategory(safeGetString(exp, "category"));
                                    explanation.setDecision(safeGetString(exp, "decision"));
                                    explanation.setReason(safeGetString(exp, "reason"));
                                    explanation.setKeyFactor(safeGetString(exp, "key_factor"));
                                    explanation.setImpact(safeGetString(exp, "impact"));
                                    return explanation;
                                })
                                .collect(Collectors.toList());
                            
                            detailedExplanations.setExplanations(explanations);
                        }
                    }
                    
                    // Map summary
                    if (explanationsMap.containsKey("summary")) {
                        Object summaryObj = explanationsMap.get("summary");
                        if (summaryObj instanceof Map) {
                            Map<String, Object> summaryMap = (Map<String, Object>) summaryObj;
                            
                            LoanDecisionResponse.DecisionSummary summary = 
                                new LoanDecisionResponse.DecisionSummary();
                            summary.setKeyRecommendation(safeGetString(summaryMap, "key_recommendation"));
                            summary.setPrimaryReason(safeGetString(summaryMap, "primary_reason"));
                            summary.setInterestRateJustification(safeGetString(summaryMap, "interest_rate_justification"));
                            summary.setConfidenceLevel(safeGetString(summaryMap, "confidence_level"));
                            
                            detailedExplanations.setSummary(summary);
                        }
                    }
                    
                    response.setDetailedExplanations(detailedExplanations);
                    log.info("✅ Mapped {} detailed explanations", 
                        detailedExplanations.getExplanations() != null ? 
                        detailedExplanations.getExplanations().size() : 0);
                }
            }
        } catch (Exception e) {
            log.warn("⚠️ Could not map detailed explanations: {}", e.getMessage());
        }
    }
    
    @SuppressWarnings("unchecked")
    private void mapDecisionTable(Map<String, Object> mlResponse, LoanDecisionResponse response) {
        try {
            if (mlResponse.containsKey("decision_table")) {
                Object decisionTableObj = mlResponse.get("decision_table");
                if (decisionTableObj instanceof Map) {
                    Map<String, Object> decisionTableMap = (Map<String, Object>) decisionTableObj;
                    
                    LoanDecisionResponse.DecisionTable decisionTable = 
                        new LoanDecisionResponse.DecisionTable();
                    
                    // Map interest rate breakdown
                    if (decisionTableMap.containsKey("interest_rate_breakdown")) {
                        Object breakdownObj = decisionTableMap.get("interest_rate_breakdown");
                        if (breakdownObj instanceof List) {
                            List<Map<String, Object>> breakdownList = (List<Map<String, Object>>) breakdownObj;
                            
                            List<LoanDecisionResponse.InterestRateComponent> breakdown = breakdownList.stream()
                                .map(item -> {
                                    LoanDecisionResponse.InterestRateComponent component = 
                                        new LoanDecisionResponse.InterestRateComponent();
                                    component.setComponent(safeGetString(item, "component"));
                                    component.setValue(safeGetString(item, "value"));
                                    component.setReason(safeGetString(item, "reason"));
                                    return component;
                                })
                                .collect(Collectors.toList());
                            
                            decisionTable.setInterestRateBreakdown(breakdown);
                        }
                    }
                    
                    // Map eligibility factors
                    if (decisionTableMap.containsKey("eligibility_factors")) {
                        Object factorsObj = decisionTableMap.get("eligibility_factors");
                        if (factorsObj instanceof List) {
                            List<Map<String, Object>> factorsList = (List<Map<String, Object>>) factorsObj;
                            
                            List<LoanDecisionResponse.EligibilityFactor> factors = factorsList.stream()
                                .map(item -> {
                                    LoanDecisionResponse.EligibilityFactor factor = 
                                        new LoanDecisionResponse.EligibilityFactor();
                                    factor.setFactor(safeGetString(item, "factor"));
                                    factor.setStatus(safeGetString(item, "status"));
                                    factor.setImpact(safeGetString(item, "impact"));
                                    return factor;
                                })
                                .collect(Collectors.toList());
                            
                            decisionTable.setEligibilityFactors(factors);
                        }
                    }
                    
                    // Map risk assessment
                    if (decisionTableMap.containsKey("risk_assessment")) {
                        Object riskObj = decisionTableMap.get("risk_assessment");
                        if (riskObj instanceof List) {
                            List<Map<String, Object>> riskList = (List<Map<String, Object>>) riskObj;
                            
                            List<LoanDecisionResponse.RiskAssessment> riskAssessments = riskList.stream()
                                .map(item -> {
                                    LoanDecisionResponse.RiskAssessment risk = 
                                        new LoanDecisionResponse.RiskAssessment();
                                    risk.setRiskCategory(safeGetString(item, "risk_category"));
                                    risk.setLevel(safeGetString(item, "level"));
                                    risk.setScore(safeGetString(item, "score"));
                                    return risk;
                                })
                                .collect(Collectors.toList());
                            
                            decisionTable.setRiskAssessment(riskAssessments);
                        }
                    }
                    
                    // Map recommendations
                    if (decisionTableMap.containsKey("recommendations")) {
                        Object recommendationsObj = decisionTableMap.get("recommendations");
                        if (recommendationsObj instanceof List) {
                            List<Map<String, Object>> recommendationsList = (List<Map<String, Object>>) recommendationsObj;
                            
                            List<LoanDecisionResponse.Recommendation> recommendations = recommendationsList.stream()
                                .map(item -> {
                                    LoanDecisionResponse.Recommendation rec = 
                                        new LoanDecisionResponse.Recommendation();
                                    rec.setAction(safeGetString(item, "action"));
                                    rec.setStatus(safeGetString(item, "status"));
                                    rec.setDetails(safeGetString(item, "details"));
                                    return rec;
                                })
                                .collect(Collectors.toList());
                            
                            decisionTable.setRecommendations(recommendations);
                        }
                    }
                    
                    // Map summary
                    decisionTable.setSummary(safeGetString(decisionTableMap, "summary"));
                    
                    response.setDecisionTable(decisionTable);
                }
            }
        } catch (Exception e) {
            log.warn("⚠️ Could not map decision table: {}", e.getMessage());
        }
    }
    
    private void mapHtmlDecisionTable(Map<String, Object> mlResponse, LoanDecisionResponse response) {
        try {
            if (mlResponse.containsKey("html_decision_table")) {
                Object htmlObj = mlResponse.get("html_decision_table");
                if (htmlObj instanceof String) {
                    String htmlTable = (String) htmlObj;
                    response.setHtmlDecisionTable(htmlTable);
                    log.info("✅ HTML decision table mapped ({} chars)", htmlTable.length());
                }
            }
        } catch (Exception e) {
            log.warn("⚠️ Could not map HTML decision table: {}", e.getMessage());
        }
    }
    
    private String safeGetString(Map<String, Object> map, String key) {
        try {
            Object value = map.get(key);
            return value != null ? value.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }
    
    private Double convertToDouble(Object value) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        } else if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException e) {
                return 0.0;
            }
        }
        return 0.0;
    }
    
    private LoanDecisionResponse createFallbackDecision(LoanAssessmentRequest request, String errorMessage) {
        LoanDecisionResponse fallback = new LoanDecisionResponse(
            request.getMemberId(), 
            "ERROR: " + errorMessage
        );
        
        // Set basic fallback values
        fallback.setEligibilityAmount(10000.0);
        fallback.setEligibilityConfidence(0.3);
        fallback.setLoanRisk("MEDIUM");
        fallback.setRiskProbability(0.5);
        fallback.setRiskConfidence(0.3);
        fallback.setSentimentRisk("MEDIUM");
        fallback.setSentimentConfidence(0.2);
        fallback.setDecisionReasoning("Fallback decision due to ML service unavailability");
        fallback.setProcessedAt(LocalDateTime.now());
        
        return fallback;
    }
    
    // Health check method
    public boolean isMLServiceHealthy() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                "http://localhost:5000/health", 
                String.class
            );
            return response.getStatusCode() == HttpStatus.OK;
        } catch (Exception e) {
            log.warn("ML service health check failed: {}", e.getMessage());
            return false;
        }
    }
}