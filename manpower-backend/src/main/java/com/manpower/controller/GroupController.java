package com.manpower.controller;

import com.manpower.dto.GroupSettingsDTO;
import com.manpower.entity.Group;
import com.manpower.service.GroupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.101:8081"})
@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    @Autowired
    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    // ========== EXISTING GROUP ENDPOINTS ==========
    
    @PostMapping
    public Group createGroup(@RequestBody Group group) {
        return groupService.saveGroup(group);
    }

    @GetMapping
    public List<Group> getAllGroups() {
        return groupService.getAllGroups();
    }

    @GetMapping("/{id}")
    public Optional<Group> getGroupById(@PathVariable String id) {
        return groupService.getGroupById(id);
    }

    @DeleteMapping("/{id}")
    public void deleteGroup(@PathVariable String id) {
        groupService.deleteGroup(id);
    }

    @GetMapping("/groupadmin/{creatorId}")
    public List<Group> getGroupsByCreator(@PathVariable String creatorId) {
        return groupService.getGroupsByCreator(creatorId);
    }

    @PutMapping("/{id}/terminate")
    public Group terminateGroup(@PathVariable String id) {
        return groupService.terminateGroup(id);
    }
    
    // ========== NEW EDIT GROUP ENDPOINT (CONTRIBUTION SETTINGS) ==========
    
    /**
     * Update group contribution settings
     * PUT /api/groups/{groupId}/settings
     * 
     * Request Body Example:
     * {
     *     "contributionFrequency": "MONTHLY",
     *     "expectedContributionAmount": 1000.00,
     *     "enablePenalty": true,
     *     "penaltyAmount": 100.00,
     *     "gracePeriodDays": 3,
     *     "enableReminders": true,
     *     "reminderDaysBefore": 2,
     *     "contributionDueDay": 5
     * }
     */
    @PutMapping("/{groupId}/settings")
    public ResponseEntity<Map<String, Object>> updateGroupSettings(
            @PathVariable String groupId,
            @RequestBody GroupSettingsDTO settingsDTO,
            @RequestHeader(value = "X-User-Id", required = true) String adminId) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            Group updatedGroup = groupService.updateGroupSettings(groupId, settingsDTO, adminId);
            
            response.put("status", 200);
            response.put("message", "Group contribution settings updated successfully");
            response.put("groupId", updatedGroup.getId());
            response.put("groupName", updatedGroup.getGroupName());
            response.put("contributionFrequency", updatedGroup.getContributionFrequency());
            response.put("expectedContributionAmount", updatedGroup.getExpectedContributionAmount());
            response.put("enablePenalty", updatedGroup.getEnablePenalty());
            response.put("penaltyAmount", updatedGroup.getPenaltyAmount());
            response.put("gracePeriodDays", updatedGroup.getGracePeriodDays());
            response.put("enableReminders", updatedGroup.getEnableReminders());
            response.put("reminderDaysBefore", updatedGroup.getReminderDaysBefore());
            response.put("contributionDueDay", updatedGroup.getContributionDueDay());
            response.put("nextContributionDate", updatedGroup.getNextContributionDate());
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 400);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error updating group settings: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Get group contribution settings
     * GET /api/groups/{groupId}/settings
     */
    @GetMapping("/{groupId}/settings")
    public ResponseEntity<Map<String, Object>> getGroupSettings(@PathVariable String groupId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            GroupSettingsDTO settings = groupService.getGroupSettings(groupId);
            
            response.put("status", 200);
            response.put("message", "Group settings retrieved successfully");
            response.put("settings", settings);
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 404);
            response.put("message", e.getMessage());
            return ResponseEntity.status(404).body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error retrieving group settings: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Generate pending contributions for a group manually
     * POST /api/groups/{groupId}/contributions/generate
     */
    @PostMapping("/{groupId}/contributions/generate")
    public ResponseEntity<Map<String, Object>> generatePendingContributions(@PathVariable String groupId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            groupService.generatePendingContributions(groupId);
            
            response.put("status", 200);
            response.put("message", "Pending contributions generated successfully for group: " + groupId);
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 400);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error generating contributions: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    // ========== MPESA CONFIGURATION ENDPOINTS ==========
    
    @PostMapping("/{groupId}/mpesa/configure")
    public ResponseEntity<Map<String, Object>> configureGroupMpesa(
            @PathVariable String groupId,
            @RequestBody Map<String, String> mpesaConfig) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            String consumerKey = mpesaConfig.get("consumerKey");
            String consumerSecret = mpesaConfig.get("consumerSecret");
            String businessShortcode = mpesaConfig.get("businessShortcode");
            String passkey = mpesaConfig.get("passkey");
            String callbackUrl = mpesaConfig.get("callbackUrl");
            
            if (consumerKey == null || consumerKey.isEmpty() ||
                consumerSecret == null || consumerSecret.isEmpty() ||
                businessShortcode == null || businessShortcode.isEmpty() ||
                passkey == null || passkey.isEmpty()) {
                
                response.put("status", 400);
                response.put("message", "Missing required MPESA configuration fields");
                response.put("required", "consumerKey, consumerSecret, businessShortcode, passkey");
                return ResponseEntity.badRequest().body(response);
            }
            
            Group updatedGroup = groupService.configureGroupMpesa(
                    groupId, consumerKey, consumerSecret, businessShortcode, passkey, callbackUrl);
            
            response.put("status", 200);
            response.put("message", "MPESA configuration updated successfully");
            response.put("group", updatedGroup.getGroupName());
            response.put("groupId", updatedGroup.getId());
            response.put("businessShortcode", updatedGroup.getMpesaBusinessShortcode());
            response.put("callbackUrl", updatedGroup.getMpesaCallbackUrl());
            response.put("isActive", updatedGroup.getMpesaIsActive());
            response.put("lastConfigured", updatedGroup.getMpesaLastConfigured());
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 400);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error configuring MPESA: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    @PutMapping("/{groupId}/mpesa/toggle")
    public ResponseEntity<Map<String, Object>> toggleGroupMpesa(
            @PathVariable String groupId,
            @RequestParam boolean active) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            Group updatedGroup = groupService.toggleGroupMpesa(groupId, active);
            
            response.put("status", 200);
            response.put("message", "MPESA " + (active ? "activated" : "deactivated") + " successfully");
            response.put("group", updatedGroup.getGroupName());
            response.put("groupId", updatedGroup.getId());
            response.put("isActive", updatedGroup.getMpesaIsActive());
            response.put("lastConfigured", updatedGroup.getMpesaLastConfigured());
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 400);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error toggling MPESA status: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    @GetMapping("/{groupId}/mpesa/config")
    public ResponseEntity<Map<String, Object>> getGroupMpesaConfig(@PathVariable String groupId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            Optional<Group> groupOpt = groupService.getGroupById(groupId);
            
            if (!groupOpt.isPresent()) {
                response.put("status", 404);
                response.put("message", "Group not found");
                return ResponseEntity.status(404).body(response);
            }
            
            Group group = groupOpt.get();
            
            Map<String, Object> config = new HashMap<>();
            config.put("groupId", group.getId());
            config.put("groupName", group.getGroupName());
            config.put("businessShortcode", group.getMpesaBusinessShortcode());
            config.put("callbackUrl", group.getMpesaCallbackUrl());
            config.put("isActive", group.getMpesaIsActive());
            config.put("lastConfigured", group.getMpesaLastConfigured());
            config.put("hasConsumerKey", group.getMpesaConsumerKey() != null && !group.getMpesaConsumerKey().isEmpty());
            config.put("hasConsumerSecret", group.getMpesaConsumerSecret() != null && !group.getMpesaConsumerSecret().isEmpty());
            config.put("hasPasskey", group.getMpesaPasskey() != null && !group.getMpesaPasskey().isEmpty());
            
            response.put("status", 200);
            response.put("message", "MPESA configuration retrieved successfully");
            response.put("config", config);
            
            return ResponseEntity.ok().body(response);
            
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error retrieving MPESA config: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    @PutMapping("/{groupId}/mpesa/callback")
    public ResponseEntity<Map<String, Object>> updateMpesaCallbackUrl(
            @PathVariable String groupId,
            @RequestParam String callbackUrl) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            Group updatedGroup = groupService.updateMpesaCallbackUrl(groupId, callbackUrl);
            
            response.put("status", 200);
            response.put("message", "Callback URL updated successfully");
            response.put("group", updatedGroup.getGroupName());
            response.put("groupId", updatedGroup.getId());
            response.put("callbackUrl", updatedGroup.getMpesaCallbackUrl());
            response.put("lastConfigured", updatedGroup.getMpesaLastConfigured());
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 400);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error updating callback URL: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    @GetMapping("/mpesa/active")
    public ResponseEntity<Map<String, Object>> getAllGroupsWithActiveMpesa() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<Group> groups = groupService.getAllGroupsWithActiveMpesa();
            
            response.put("status", 200);
            response.put("message", "Found " + groups.size() + " groups with active MPESA");
            response.put("count", groups.size());
            
            List<Map<String, Object>> groupInfoList = new ArrayList<>();
            for (Group group : groups) {
                Map<String, Object> groupInfo = new HashMap<>();
                groupInfo.put("id", group.getId());
                groupInfo.put("name", group.getGroupName());
                groupInfo.put("businessShortcode", group.getMpesaBusinessShortcode());
                groupInfo.put("callbackUrl", group.getMpesaCallbackUrl());
                groupInfo.put("lastConfigured", group.getMpesaLastConfigured());
                groupInfoList.add(groupInfo);
            }
            
            response.put("groups", groupInfoList);
            
            return ResponseEntity.ok().body(response);
            
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error retrieving groups with active MPESA: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    @PostMapping("/{groupId}/mpesa/test")
    public ResponseEntity<Map<String, Object>> testMpesaConfiguration(@PathVariable String groupId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            Optional<Group> groupOpt = groupService.getGroupWithActiveMpesa(groupId);
            
            if (!groupOpt.isPresent()) {
                response.put("status", 400);
                response.put("message", "Group not found or MPESA not active");
                return ResponseEntity.badRequest().body(response);
            }
            
            Group group = groupOpt.get();
            
            Map<String, Object> testResult = new HashMap<>();
            testResult.put("group", group.getGroupName());
            testResult.put("businessShortcode", group.getMpesaBusinessShortcode());
            testResult.put("hasConsumerKey", group.getMpesaConsumerKey() != null && !group.getMpesaConsumerKey().isEmpty());
            testResult.put("hasConsumerSecret", group.getMpesaConsumerSecret() != null && !group.getMpesaConsumerSecret().isEmpty());
            testResult.put("hasPasskey", group.getMpesaPasskey() != null && !group.getMpesaPasskey().isEmpty());
            testResult.put("callbackUrl", group.getMpesaCallbackUrl());
            testResult.put("isActive", group.getMpesaIsActive());
            testResult.put("lastConfigured", group.getMpesaLastConfigured());
            
            response.put("status", 200);
            response.put("message", "MPESA configuration is valid");
            response.put("testResult", testResult);
            
            return ResponseEntity.ok().body(response);
            
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error testing MPESA configuration: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
}