package com.manpower.controller;

import com.manpower.entity.Contribution;
import com.manpower.service.ContributionService;
import com.manpower.dto.ErrorResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.101:8081"})
@RestController
@RequestMapping("/api/contributions")
public class ContributionController {

    @Autowired
    private ContributionService contributionService;

    @PostMapping
    public ResponseEntity<Object> createContribution(@Valid @RequestBody Contribution contribution) {
        try {
            Contribution savedContribution = contributionService.saveContribution(contribution);
            return new ResponseEntity<>(savedContribution, HttpStatus.CREATED);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to create contribution: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping
    public ResponseEntity<List<Contribution>> getAllContributions() {
        List<Contribution> contributions = contributionService.getAllContributions();
        return new ResponseEntity<>(contributions, HttpStatus.OK);
    }

    @GetMapping("/member/{memberId}")
    public ResponseEntity<Object> getContributionsByMemberId(@PathVariable String memberId) {
        try {
            List<Contribution> contributions = contributionService.getContributionsByMemberId(memberId);
            return new ResponseEntity<>(contributions, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to fetch contributions for member: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<Object> getContributionsByGroupId(@PathVariable String groupId) {
        try {
            List<Contribution> contributions = contributionService.getContributionsByGroupId(groupId);
            return new ResponseEntity<>(contributions, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to fetch contributions for group: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ✅ GET: Total contributions for a group
    @GetMapping("/group/{groupId}/total")
    public ResponseEntity<Object> getTotalContributionsByGroup(@PathVariable String groupId) {
        try {
            BigDecimal total = contributionService.getTotalContributionsByGroup(groupId);
            return new ResponseEntity<>(total, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to calculate total contributions: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Contribution> getContributionById(@PathVariable String id) {
        Optional<Contribution> contribution = contributionService.getContributionById(id);
        return contribution.map(value -> new ResponseEntity<>(value, HttpStatus.OK))
                           .orElseGet(() -> new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    // ✅ NEW: PUT endpoint for updating a contribution
    @PutMapping("/{id}")
    public ResponseEntity<Object> updateContribution(
            @PathVariable String id,
            @RequestBody Map<String, Object> updates) {
        try {
            Contribution updatedContribution = contributionService.updateContribution(id, updates);
            return new ResponseEntity<>(updatedContribution, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to update contribution: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteContribution(@PathVariable String id) {
        try {
            contributionService.deleteContribution(id);
            return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<Object> getContributionSummary(@RequestParam(required = false) String groupId) {
        try {
            return new ResponseEntity<>(contributionService.getContributionSummary(groupId), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to fetch contribution summary: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}