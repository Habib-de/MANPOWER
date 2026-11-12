package com.manpower.controller;

import com.manpower.entity.Investment;
import com.manpower.service.InvestmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/investments")
@CrossOrigin(origins = "*")
public class InvestmentController {

    @Autowired
    private InvestmentService investmentService;

    // Create new investment
    @PostMapping
    public ResponseEntity<Investment> createInvestment(@RequestBody Investment investment) {
        Investment createdInvestment = investmentService.createInvestment(investment);
        return ResponseEntity.ok(createdInvestment);
    }

    // Get all investments
    @GetMapping
    public ResponseEntity<List<Investment>> getAllInvestments() {
        List<Investment> investments = investmentService.getAllInvestments();
        return ResponseEntity.ok(investments);
    }

    // Get investment by ID
    @GetMapping("/{id}")
    public ResponseEntity<Investment> getInvestmentById(@PathVariable String id) {
        Optional<Investment> investment = investmentService.getInvestmentById(id);
        return investment.map(ResponseEntity::ok)
                        .orElse(ResponseEntity.notFound().build());
    }

    // Update investment
    @PutMapping("/{id}")
    public ResponseEntity<Investment> updateInvestment(@PathVariable String id, @RequestBody Investment investment) {
        try {
            Investment updatedInvestment = investmentService.updateInvestment(id, investment);
            return ResponseEntity.ok(updatedInvestment);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Delete investment
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInvestment(@PathVariable String id) {
        investmentService.deleteInvestment(id);
        return ResponseEntity.ok().build();
    }

    // Get investments by group
    @GetMapping("/group/{groupId}")
    public ResponseEntity<List<Investment>> getInvestmentsByGroup(@PathVariable String groupId) {
        List<Investment> investments = investmentService.getInvestmentsByGroup(groupId);
        return ResponseEntity.ok(investments);
    }

    // Get investments by status
    @GetMapping("/status/{status}")
    public ResponseEntity<List<Investment>> getInvestmentsByStatus(@PathVariable Investment.InvestmentStatus status) {
        List<Investment> investments = investmentService.getInvestmentsByStatus(status);
        return ResponseEntity.ok(investments);
    }

    // Get investments by type
    @GetMapping("/type/{type}")
    public ResponseEntity<List<Investment>> getInvestmentsByType(@PathVariable Investment.InvestmentType type) {
        List<Investment> investments = investmentService.getInvestmentsByType(type);
        return ResponseEntity.ok(investments);
    }

    // Get total invested amount by group
    @GetMapping("/group/{groupId}/total-invested")
    public ResponseEntity<BigDecimal> getTotalInvestedAmountByGroup(@PathVariable String groupId) {
        BigDecimal total = investmentService.getTotalInvestedAmountByGroup(groupId);
        return ResponseEntity.ok(total);
    }

    // Get group portfolio value
    @GetMapping("/group/{groupId}/portfolio-value")
    public ResponseEntity<BigDecimal> getGroupPortfolioValue(@PathVariable String groupId) {
        BigDecimal portfolioValue = investmentService.getGroupInvestmentPortfolioValue(groupId);
        return ResponseEntity.ok(portfolioValue);
    }

    // Update investment status
    @PatchMapping("/{id}/status")
    public ResponseEntity<Investment> updateInvestmentStatus(
            @PathVariable String id, 
            @RequestParam Investment.InvestmentStatus status) {
        try {
            Investment updatedInvestment = investmentService.updateInvestmentStatus(id, status);
            return ResponseEntity.ok(updatedInvestment);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Update current value
    @PatchMapping("/{id}/current-value")
    public ResponseEntity<Investment> updateCurrentValue(
            @PathVariable String id, 
            @RequestParam BigDecimal currentValue) {
        try {
            Investment updatedInvestment = investmentService.updateCurrentValue(id, currentValue);
            return ResponseEntity.ok(updatedInvestment);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Get investments nearing maturity
    @GetMapping("/nearing-maturity")
    public ResponseEntity<List<Investment>> getInvestmentsNearingMaturity(
            @RequestParam(defaultValue = "30") int days) {
        List<Investment> investments = investmentService.getInvestmentsNearingMaturity(days);
        return ResponseEntity.ok(investments);
    }
}