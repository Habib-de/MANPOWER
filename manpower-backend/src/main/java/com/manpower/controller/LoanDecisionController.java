package com.manpower.controller;

import com.manpower.dto.LoanAssessmentRequest;
import com.manpower.dto.LoanDecisionResponse;
import com.manpower.entity.LoanDecisionLog;
import com.manpower.service.MLIntegrationService;
import com.manpower.service.LoanDecisionLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/loan")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class LoanDecisionController {
    
    private final MLIntegrationService mlIntegrationService;
    private final LoanDecisionLogService loanDecisionLogService;
    
    @PostMapping("/decide")
    public ResponseEntity<LoanDecisionResponse> assessLoanEligibility(
            @Valid @RequestBody LoanAssessmentRequest request) {
        
        log.info("🎯 Starting loan assessment for member: {}", request.getMemberId());
        
        try {
            // Step 1: Call ML orchestrator for decision
            LoanDecisionResponse mlDecision = mlIntegrationService.getLoanDecision(request);
            
            // Step 2: Log the decision and GET THE SAVED LOG WITH ID
            // FIXED: Replaced 'var' with explicit type
            LoanDecisionLog savedDecisionLog = loanDecisionLogService.logDecision(request, mlDecision);
            
            // ✅ CRITICAL FIX: Set the decisionLogId in the response
            mlDecision.setDecisionLogId(savedDecisionLog.getId());
            
            // Step 3: Return the decision to frontend WITH decisionLogId
            log.info("✅ Loan assessment completed for member: {}. Recommendation: {}, DecisionLogId: {}", 
                request.getMemberId(), mlDecision.getFinalRecommendation(), savedDecisionLog.getId());
            
            return ResponseEntity.ok(mlDecision);
            
        } catch (Exception e) {
            log.error("❌ Loan assessment failed for member {}: {}", 
                request.getMemberId(), e.getMessage());
            
            LoanDecisionResponse errorResponse = new LoanDecisionResponse(
                request.getMemberId(),
                "Assessment failed: " + e.getMessage()
            );
            
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new HashMap<>();
        
        boolean mlServiceHealthy = mlIntegrationService.isMLServiceHealthy();
        
        health.put("status", "UP");
        health.put("ml_orchestrator", mlServiceHealthy ? "CONNECTED" : "DISCONNECTED");
        health.put("service", "Loan Decision API");
        health.put("timestamp", java.time.LocalDateTime.now());
        
        return ResponseEntity.ok(health);
    }
    
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDecisionStats() {
        try {
            Map<String, Object> stats = loanDecisionLogService.getDecisionStatistics();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Error getting decision statistics: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}