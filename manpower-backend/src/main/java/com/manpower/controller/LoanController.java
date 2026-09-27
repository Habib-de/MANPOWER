// ✅ ENHANCED LOAN CONTROLLER WITH ML INTEGRATION - FIXED INTEREST RATE ISSUE
package com.manpower.controller;

import com.manpower.entity.Loan;
import com.manpower.service.LoanService;
import com.manpower.service.LoanDecisionLogService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;

@CrossOrigin(origins = {"http://localhost:8081", "http://172.20.10.2:8081"})
@RestController
@RequestMapping("/api/loans")
public class LoanController {

    @Autowired
    private LoanService loanService;

    @Autowired
    private LoanDecisionLogService loanDecisionLogService;

    // ============ EXISTING ENDPOINTS (Keep all your current functionality) ============

    @Operation(summary = "Create a loan")
    @PostMapping
    public Loan create(@RequestBody Loan loan) {
        if (loan.getId() == null || loan.getId().trim().isEmpty()) {
            loan.setId(UUID.randomUUID().toString());
        }
        return loanService.saveLoan(loan);
    }

    @Operation(summary = "Get all loans")
    @GetMapping
    public List<Loan> getAll() {
        return loanService.getAllLoans();
    }

    @Operation(summary = "Get loan by ID")
    @GetMapping("/{id}")
    public Optional<Loan> getById(@PathVariable String id) {
        return loanService.getLoanById(id);
    }

    @Operation(summary = "Update a loan")
    @PutMapping("/{id}")
    public Loan update(@PathVariable String id, @RequestBody Loan loan) {
        loan.setId(id);
        return loanService.saveLoan(loan);
    }

    @Operation(summary = "Delete a loan")
    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        loanService.deleteLoan(id);
    }

    @Operation(summary = "Process a payment for a loan")
    @PostMapping("/{loanId}/pay")
    public ResponseEntity<Loan> processPayment(@PathVariable String loanId, @RequestBody Map<String, Object> payload) {
        try {
            if (!payload.containsKey("paymentAmount") || payload.get("paymentAmount") == null) {
                return ResponseEntity.badRequest().body(null);
            }

            BigDecimal paymentAmount;
            Object amount = payload.get("paymentAmount");
            if (amount instanceof Number) {
                paymentAmount = BigDecimal.valueOf(((Number) amount).doubleValue());
            } else {
                return ResponseEntity.badRequest().body(null);
            }

            Loan updatedLoan = loanService.processPayment(loanId, paymentAmount);
            return ResponseEntity.ok(updatedLoan);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(null);
        }
    }

    // ============ NEW ML INTEGRATION ENDPOINTS ============

    @Operation(summary = "Create a loan from ML decision")
    @PostMapping("/create-from-ml-decision")
    public ResponseEntity<?> createLoanFromMlDecision(@RequestBody Map<String, Object> request) {
        try {
            // Extract required parameters
            String memberId = (String) request.get("memberId");
            String groupId = (String) request.get("groupId");
            Long mlDecisionLogId = null;
            BigDecimal interestRate = null; // ✅ ADDED: Extract interest rate
            
            // Handle different possible types for mlDecisionLogId
            Object decisionIdObj = request.get("mlDecisionLogId");
            if (decisionIdObj instanceof Number) {
                mlDecisionLogId = ((Number) decisionIdObj).longValue();
            } else if (decisionIdObj instanceof String) {
                mlDecisionLogId = Long.parseLong((String) decisionIdObj);
            }

            // ✅ ADDED: Extract interest rate from request
            Object interestRateObj = request.get("interestRate");
            if (interestRateObj instanceof Number) {
                interestRate = BigDecimal.valueOf(((Number) interestRateObj).doubleValue());
            } else if (interestRateObj instanceof String) {
                interestRate = new BigDecimal((String) interestRateObj);
            }

            // ✅ UPDATED: Check for interestRate parameter
            if (memberId == null || groupId == null || mlDecisionLogId == null || interestRate == null) {
                return ResponseEntity.badRequest().body(createErrorResponse(
                    "Missing required parameters: memberId, groupId, mlDecisionLogId, interestRate"
                ));
            }

            // ✅ FIXED: Pass interestRate to the service
            Loan createdLoan = loanService.createLoanFromMlDecision(memberId, groupId, mlDecisionLogId, interestRate);
            
            return ResponseEntity.ok(createSuccessResponse("Loan created successfully from ML decision", createdLoan));
            
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(createErrorResponse("Invalid number format: " + e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to create loan: " + e.getMessage()));
        }
    }

    @Operation(summary = "Get ML-approved loans for a member")
    @GetMapping("/member/{memberId}/ml-approved")
    public ResponseEntity<?> getMlApprovedLoansByMember(@PathVariable String memberId) {
        try {
            List<Loan> mlLoans = loanService.getMlApprovedLoansByMember(memberId);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Found " + mlLoans.size() + " ML-approved loans");
            response.put("data", mlLoans);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to fetch ML-approved loans: " + e.getMessage()));
        }
    }

    @Operation(summary = "Check if member has ML-approved loans")
    @GetMapping("/member/{memberId}/has-ml-loans")
    public ResponseEntity<?> hasMlApprovedLoans(@PathVariable String memberId) {
        try {
            boolean hasMlLoans = loanService.hasMlApprovedLoans(memberId);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("hasMlApprovedLoans", hasMlLoans);
            response.put("memberId", memberId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to check ML loans: " + e.getMessage()));
        }
    }

    @Operation(summary = "Get ML loan statistics")
    @GetMapping("/stats/ml-analytics")
    public ResponseEntity<?> getMlLoanStatistics() {
        try {
            Map<String, Object> stats = loanService.getMlLoanStatistics();
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", stats);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to fetch ML statistics: " + e.getMessage()));
        }
    }

    @Operation(summary = "Get loan decision history for member")
    @GetMapping("/member/{memberId}/decision-history")
    public ResponseEntity<?> getLoanDecisionHistory(@PathVariable String memberId) {
        try {
            Object decisionHistory = loanDecisionLogService.getDecisionStatistics();
            Optional<?> latestDecision = loanDecisionLogService.getLatestDecisionForMember(memberId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("memberId", memberId);
            response.put("latestDecision", latestDecision.orElse(null));
            response.put("decisionHistory", decisionHistory);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to fetch decision history: " + e.getMessage()));
        }
    }

    @Operation(summary = "Create ML-approved loan with custom parameters")
    @PostMapping("/create-ml-loan")
    public ResponseEntity<?> createMlLoan(@RequestBody Map<String, Object> request) {
        try {
            // Extract required parameters
            String memberId = (String) request.get("memberId");
            String groupId = (String) request.get("groupId");
            Long mlDecisionLogId = null;
            BigDecimal interestRate = null; // ✅ ADDED: Extract interest rate
            
            Object decisionIdObj = request.get("mlDecisionLogId");
            if (decisionIdObj instanceof Number) {
                mlDecisionLogId = ((Number) decisionIdObj).longValue();
            } else if (decisionIdObj instanceof String) {
                mlDecisionLogId = Long.parseLong((String) decisionIdObj);
            }

            // ✅ ADDED: Extract interest rate from request
            Object interestRateObj = request.get("interestRate");
            if (interestRateObj instanceof Number) {
                interestRate = BigDecimal.valueOf(((Number) interestRateObj).doubleValue());
            } else if (interestRateObj instanceof String) {
                interestRate = new BigDecimal((String) interestRateObj);
            }

            // ✅ UPDATED: Check for interestRate parameter
            if (memberId == null || groupId == null || mlDecisionLogId == null || interestRate == null) {
                return ResponseEntity.badRequest().body(createErrorResponse(
                    "Missing required parameters: memberId, groupId, mlDecisionLogId, interestRate"
                ));
            }

            // Optional custom parameters
            BigDecimal customAmount = null;
            if (request.containsKey("customAmount")) {
                Object amountObj = request.get("customAmount");
                if (amountObj instanceof Number) {
                    customAmount = BigDecimal.valueOf(((Number) amountObj).doubleValue());
                }
            }

            // ✅ FIXED: Pass interestRate to the service
            Loan createdLoan = loanService.createLoanFromMlDecision(memberId, groupId, mlDecisionLogId, interestRate);
            
            // If custom amount was provided, update the loan
            if (customAmount != null && customAmount.compareTo(BigDecimal.ZERO) > 0) {
                createdLoan.setAmount(customAmount);
                createdLoan.setMlApprovedAmount(customAmount);
                createdLoan = loanService.saveLoan(createdLoan);
            }

            return ResponseEntity.ok(createSuccessResponse("ML loan created successfully", createdLoan));
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to create ML loan: " + e.getMessage()));
        }
    }

        // ============ GUARANTOR ENDPOINTS ============

    @Operation(summary = "Get guarantor capacity for a member")
    @GetMapping("/guarantor-capacity/{memberId}")
    public ResponseEntity<?> getGuarantorCapacity(@PathVariable String memberId) {
        try {
            BigDecimal availableCapacity = loanService.calculateGuarantorCapacity(memberId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("memberId", memberId);
            response.put("availableCapacity", availableCapacity);
            response.put("message", "Guarantor capacity calculated successfully");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to calculate guarantor capacity: " + e.getMessage()));
        }
    }

    // ============ NEW GUARANTOR ACCEPTANCE/DECLINE ENDPOINTS ============

    @Operation(summary = "Accept guarantee for a loan")
    @PostMapping("/{loanId}/accept-guarantee")
    public ResponseEntity<?> acceptGuarantee(@PathVariable String loanId, @RequestBody Map<String, String> request) {
        try {
            String guarantorId = request.get("guarantorId");
            if (guarantorId == null || guarantorId.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(createErrorResponse("guarantorId is required"));
            }
            
            Loan updatedLoan = loanService.acceptGuarantee(loanId, guarantorId);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Guarantee accepted successfully");
            response.put("data", updatedLoan);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to accept guarantee: " + e.getMessage()));
        }
    }

    @Operation(summary = "Decline guarantee for a loan")
    @PostMapping("/{loanId}/decline-guarantee")
    public ResponseEntity<?> declineGuarantee(@PathVariable String loanId, @RequestBody Map<String, String> request) {
        try {
            String guarantorId = request.get("guarantorId");
            if (guarantorId == null || guarantorId.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(createErrorResponse("guarantorId is required"));
            }
            
            Loan updatedLoan = loanService.declineGuarantee(loanId, guarantorId);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Guarantee declined");
            response.put("data", updatedLoan);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(createErrorResponse("Failed to decline guarantee: " + e.getMessage()));
        }
    }

    // ============ HELPER METHODS ============

    private Map<String, Object> createSuccessResponse(String message, Object data) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", message);
        response.put("data", data);
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }

    private Map<String, Object> createErrorResponse(String errorMessage) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", errorMessage);
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }
}