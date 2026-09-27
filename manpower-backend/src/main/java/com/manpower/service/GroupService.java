package com.manpower.service;

import com.manpower.dto.GroupSettingsDTO;
import com.manpower.entity.Group;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GroupService {

    // ========== EXISTING METHODS ==========
    
    List<Group> getAllGroups();

    Optional<Group> getGroupById(String id);

    Group saveGroup(Group group);

    void deleteGroup(String id);

    List<Group> getGroupsByCreator(String creatorId);

    Group terminateGroup(String id);
    
    // ========== MPESA METHODS ==========
    
    Group configureGroupMpesa(String groupId, 
                             String consumerKey, 
                             String consumerSecret, 
                             String businessShortcode, 
                             String passkey, 
                             String callbackUrl);
    
    Group toggleGroupMpesa(String groupId, boolean isActive);
    
    Optional<Group> getGroupWithActiveMpesa(String groupId);
    
    List<Group> getAllGroupsWithActiveMpesa();
    
    Group updateMpesaCallbackUrl(String groupId, String callbackUrl);
    
    // ========== NEW CONTRIBUTION SETTINGS METHODS ==========
    
    // Update group contribution settings (EDIT GROUP endpoint)
    Group updateGroupSettings(String groupId, GroupSettingsDTO settingsDTO, String adminId);
    
    // Get group contribution settings
    GroupSettingsDTO getGroupSettings(String groupId);
    
    // Generate pending contributions for a group based on its schedule
    void generatePendingContributions(String groupId);
    
    // Calculate next due date based on frequency and due day
    LocalDate calculateNextDueDate(Group group);
}