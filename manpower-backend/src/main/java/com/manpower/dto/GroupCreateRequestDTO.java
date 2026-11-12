package com.manpower.dto;

import java.sql.Date;
import java.time.LocalDateTime; // Import LocalDateTime
import java.util.List;

public class GroupCreateRequestDTO {

    private String groupName;
    private String description;
    private Date creationDate; // Match frontend's Date type
    private String createdBy;
    private String modifiedBy;
    private LocalDateTime createdOn; // Added to match frontend payload for clean binding
    private LocalDateTime modifiedOn; // Added to match frontend payload for clean binding
    private String mansoftTenantId;
    private String status;
    private List<String> memberIds; // Crucial for Scenario 2

    // Getters and Setters for all fields
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Date getCreationDate() { return creationDate; }
    public void setCreationDate(Date creationDate) { this.creationDate = creationDate; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getModifiedBy() { return modifiedBy; }
    public void setModifiedBy(String modifiedBy) { this.modifiedBy = modifiedBy; }

    public LocalDateTime getCreatedOn() { return createdOn; } // Getter for createdOn
    public void setCreatedOn(LocalDateTime createdOn) { this.createdOn = createdOn; } // Setter for createdOn

    public LocalDateTime getModifiedOn() { return modifiedOn; } // Getter for modifiedOn
    public void setModifiedOn(LocalDateTime modifiedOn) { this.modifiedOn = modifiedOn; } // Setter for modifiedOn

    public String getMansoftTenantId() { return mansoftTenantId; }
    public void setMansoftTenantId(String mansoftTenantId) { this.mansoftTenantId = mansoftTenantId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getMemberIds() { return memberIds; }
    public void setMemberIds(List<String> memberIds) { this.memberIds = memberIds; }

    public GroupCreateRequestDTO() {}
}