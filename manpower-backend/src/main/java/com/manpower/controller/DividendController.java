package com.manpower.controller;

import com.manpower.entity.DividendDeclaration;
import com.manpower.entity.MemberDividend;
import com.manpower.entity.Group;
import com.manpower.service.DividendService;
import com.manpower.repository.GroupRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.*;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.101:8081"})
@RestController
@RequestMapping("/api/dividends")
public class DividendController {

    @Autowired
    private DividendService dividendService;
    
    @Autowired
    private GroupRepository groupRepository;

    // ============ DECLARATION ENDPOINTS (GROUP-BASED) ============
    
    @GetMapping("/declarations")
    public ResponseEntity<List<DividendDeclaration>> getDeclarations(@RequestParam String groupId) {
        return ResponseEntity.ok(dividendService.getDeclarationsByGroup(groupId));
    }

    @GetMapping("/declarations/current")
    public ResponseEntity<DividendDeclaration> getCurrentDeclaration(@RequestParam String groupId) {
        DividendDeclaration current = dividendService.getCurrentApprovedDeclarationByGroup(groupId);
        if (current != null) {
            return ResponseEntity.ok(current);
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/declarations")
    public ResponseEntity<?> createDeclaration(@RequestBody Map<String, Object> request) {
        try {
            String financialYear = (String) request.get("financialYear");
            BigDecimal percentageRate = BigDecimal.valueOf(((Number) request.get("percentageRate")).doubleValue());
            String declaredDateStr = (String) request.get("declaredDate");
            String groupId = (String) request.get("groupId");
            String status = (String) request.get("status");
            
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
            Date declaredDate = sdf.parse(declaredDateStr);
            
            Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with id: " + groupId));
            
            DividendDeclaration declaration = new DividendDeclaration();
            declaration.setId(UUID.randomUUID().toString());
            declaration.setFinancialYear(financialYear);
            declaration.setPercentageRate(percentageRate);
            declaration.setDeclaredDate(declaredDate);
            declaration.setStatus(status != null ? status : "DRAFT");
            declaration.setCreatedOn(new Date());
            declaration.setGroup(group);
            
            DividendDeclaration created = dividendService.createDeclaration(declaration);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
            
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/declarations/{declarationId}/approve")
    public ResponseEntity<?> approveDeclaration(@PathVariable String declarationId, @RequestBody Map<String, String> request) {
        try {
            String approverId = request.get("approverId");
            DividendDeclaration approved = dividendService.approveDeclaration(declarationId, approverId);
            return ResponseEntity.ok(approved);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // ============ MEMBER DIVIDEND ENDPOINTS (GROUP-BASED) ============
    
    @GetMapping("/member/{memberId}")
    public ResponseEntity<List<MemberDividend>> getMemberDividends(@PathVariable String memberId, @RequestParam String groupId) {
        // Verify member belongs to group
        List<MemberDividend> dividends = dividendService.getDividendsByMemberAndGroup(memberId, groupId);
        return ResponseEntity.ok(dividends);
    }

    @GetMapping("/member/{memberId}/pending")
    public ResponseEntity<List<MemberDividend>> getPendingDividends(@PathVariable String memberId, @RequestParam String groupId) {
        List<MemberDividend> dividends = dividendService.getPendingDividendsByMemberAndGroup(memberId, groupId);
        return ResponseEntity.ok(dividends);
    }

    @GetMapping("/member/{memberId}/paid")
    public ResponseEntity<List<MemberDividend>> getPaidDividends(@PathVariable String memberId, @RequestParam String groupId) {
        List<MemberDividend> dividends = dividendService.getPaidDividendsByMemberAndGroup(memberId, groupId);
        return ResponseEntity.ok(dividends);
    }

    @GetMapping("/member/{memberId}/total-paid")
    public ResponseEntity<Map<String, Object>> getTotalDividendsPaid(@PathVariable String memberId, @RequestParam String groupId) {
        Map<String, Object> response = new HashMap<>();
        response.put("memberId", memberId);
        response.put("groupId", groupId);
        response.put("totalDividendsPaid", dividendService.getTotalDividendsPaidToMemberAndGroup(memberId, groupId));
        return ResponseEntity.ok(response);
    }

    // ============ PAYMENT ENDPOINTS (GROUP-BASED) ============
    
    @GetMapping("/pending-payments")
    public ResponseEntity<?> getPendingPayments(@RequestParam String groupId) {
        try {
            List<MemberDividend> pendingPayments = dividendService.getPendingPaymentsByGroup(groupId);
            
            List<Map<String, Object>> enriched = new ArrayList<>();
            for (MemberDividend div : pendingPayments) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", div.getId());
                item.put("memberId", div.getMember().getId());
                item.put("memberName", div.getMember().getFirstName() + " " + div.getMember().getLastName());
                item.put("sharesAmount", div.getSharesAmount());
                item.put("dividendAmount", div.getDividendAmount());
                item.put("paymentStatus", div.getPaymentStatus());
                enriched.add(item);
            }
            
            return ResponseEntity.ok(enriched);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/{dividendId}/request-payment")
    public ResponseEntity<?> requestPayment(@PathVariable String dividendId, @RequestBody Map<String, String> request) {
        try {
            String paymentMethod = request.getOrDefault("paymentMethod", "MPESA");
            MemberDividend dividend = dividendService.requestPayment(dividendId, paymentMethod);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Payment request submitted successfully");
            response.put("dividend", dividend);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/{dividendId}/process-payment")
    public ResponseEntity<?> processPayment(@PathVariable String dividendId, @RequestBody Map<String, String> request) {
        try {
            String adminId = request.get("adminId");
            String paymentReference = request.get("paymentReference");
            MemberDividend dividend = dividendService.processPayment(dividendId, adminId, paymentReference);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Payment processed successfully");
            response.put("dividend", dividend);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}