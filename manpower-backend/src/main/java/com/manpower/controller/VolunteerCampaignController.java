package com.manpower.controller;

import com.manpower.dto.VolunteerCampaignRequest;
import com.manpower.dto.VolunteerCampaignResponse;
import com.manpower.service.VolunteerCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/volunteer-campaigns")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class VolunteerCampaignController {

    private final VolunteerCampaignService campaignService;

    /**
     * CREATE a new volunteer campaign (Group Admin only)
     * POST /api/volunteer-campaigns
     */
    @PostMapping
    public ResponseEntity<?> createCampaign(
            @Valid @RequestBody VolunteerCampaignRequest request,
            @RequestHeader("userId") String createdByMemberId) {
        try {
            VolunteerCampaignResponse response = campaignService.createCampaign(request, createdByMemberId);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    /**
     * GET all campaigns for a group (with optional status filter)
     * GET /api/volunteer-campaigns/group/{groupId}?status=ACTIVE
     */
    @GetMapping("/group/{groupId}")
    public ResponseEntity<?> getGroupCampaigns(
            @PathVariable String groupId,
            @RequestParam(required = false) String status) {
        try {
            List<VolunteerCampaignResponse> campaigns = campaignService.getGroupCampaigns(groupId, status);
            return ResponseEntity.ok(campaigns);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching campaigns: " + e.getMessage());
        }
    }

    /**
     * GET ONLY open campaigns for members to contribute to
     * GET /api/volunteer-campaigns/group/{groupId}/open
     */
    @GetMapping("/group/{groupId}/open")
    public ResponseEntity<?> getOpenCampaigns(@PathVariable String groupId) {
        try {
            List<VolunteerCampaignResponse> campaigns = campaignService.getOpenCampaigns(groupId);
            return ResponseEntity.ok(campaigns);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching open campaigns: " + e.getMessage());
        }
    }

    /**
     * GET a single campaign by ID
     * GET /api/volunteer-campaigns/{campaignId}
     */
    @GetMapping("/{campaignId}")
    public ResponseEntity<?> getCampaignById(@PathVariable String campaignId) {
        try {
            VolunteerCampaignResponse campaign = campaignService.getCampaignById(campaignId);
            return ResponseEntity.ok(campaign);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    /**
     * UPDATE campaign status (Group Admin only)
     * PATCH /api/volunteer-campaigns/{campaignId}/status?status=CLOSED
     */
    @PatchMapping("/{campaignId}/status")
    public ResponseEntity<?> updateCampaignStatus(
            @PathVariable String campaignId,
            @RequestParam String status,
            @RequestHeader("userId") String modifiedBy) {
        try {
            VolunteerCampaignResponse response = campaignService.updateCampaignStatus(campaignId, status, modifiedBy);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    /**
     * DELETE a campaign (only if no contributions)
     * DELETE /api/volunteer-campaigns/{campaignId}
     */
    @DeleteMapping("/{campaignId}")
    public ResponseEntity<?> deleteCampaign(
            @PathVariable String campaignId,
            @RequestHeader("userId") String deletedBy) {
        try {
            campaignService.deleteCampaign(campaignId);
            return ResponseEntity.ok("Campaign deleted successfully");
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /**
     * AUTO-CLOSE expired campaigns (Admin endpoint or scheduled job)
     * POST /api/volunteer-campaigns/auto-close
     */
    @PostMapping("/auto-close")
    public ResponseEntity<?> autoCloseExpiredCampaigns() {
        try {
            int closedCount = campaignService.autoCloseExpiredCampaigns();
            return ResponseEntity.ok("Closed " + closedCount + " expired campaigns");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error auto-closing campaigns: " + e.getMessage());
        }
    }
}