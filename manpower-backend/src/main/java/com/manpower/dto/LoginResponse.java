package com.manpower.dto;

import java.time.LocalDate;     // For joinDate
import java.time.LocalDateTime; // For createdOn, modifiedOn
import java.time.format.DateTimeFormatter; // For formatting dates to String

public class LoginResponse {
    private String id;
    private String firstName;
    private String lastName;
    private String email;
    private String role;
    private String status;
    private String mansoftTenantId;
    private String groupId;        // NEW: Group ID
    private String phoneNumber;    // NEW: Phone Number
    private String joinDate;       // NEW: Join Date (as String)
    private String createdBy;      // NEW: Created By
    private String modifiedBy;     // NEW: Modified By
    private String createdOn;      // NEW: Created On (as String)
    private String modifiedOn;     // NEW: Modified On (as String)

    // Default constructor
    public LoginResponse() {
    }

    // Updated Constructor to include all fields
    public LoginResponse(String id, String firstName, String lastName, String email,
                         String role, String status, String mansoftTenantId,
                         String groupId, String phoneNumber, LocalDate joinDate,
                         String createdBy, String modifiedBy, LocalDateTime createdOn, LocalDateTime modifiedOn) {
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.role = role;
        this.status = status;
        this.mansoftTenantId = mansoftTenantId;
        this.groupId = groupId;
        this.phoneNumber = phoneNumber;
        // Format LocalDate to String (YYYY-MM-DD)
        this.joinDate = (joinDate != null) ? joinDate.format(DateTimeFormatter.ISO_LOCAL_DATE) : null;
        this.createdBy = createdBy;
        this.modifiedBy = modifiedBy;
        // Format LocalDateTime to String (ISO_LOCAL_DATE_TIME)
        this.createdOn = (createdOn != null) ? createdOn.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null;
        this.modifiedOn = (modifiedOn != null) ? modifiedOn.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null;
    }

    // --- Getters ---
    public String getId() { return id; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public String getStatus() { return status; }
    public String getMansoftTenantId() { return mansoftTenantId; }
    public String getGroupId() { return groupId; } // NEW
    public String getPhoneNumber() { return phoneNumber; } // NEW
    public String getJoinDate() { return joinDate; } // NEW
    public String getCreatedBy() { return createdBy; } // NEW
    public String getModifiedBy() { return modifiedBy; } // NEW
    public String getCreatedOn() { return createdOn; } // NEW
    public String getModifiedOn() { return modifiedOn; } // NEW

    // --- Setters ---
    public void setId(String id) { this.id = id; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public void setLastName(String lastName) { this.lastName = lastName; } // FIX: Removed duplicate 'void' keyword
    public void setEmail(String email) { this.email = email; }
    public void setRole(String role) { this.role = role; }
    public void setStatus(String status) { this.status = status; }
    public void setMansoftTenantId(String mansoftTenantId) { this.mansoftTenantId = mansoftTenantId; }
    public void setGroupId(String groupId) { this.groupId = groupId; } // NEW
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; } // NEW
    // Setters for Date/Time fields should ideally accept LocalDate/LocalDateTime
    public void setJoinDate(LocalDate joinDate) { this.joinDate = (joinDate != null) ? joinDate.format(DateTimeFormatter.ISO_LOCAL_DATE) : null; } // NEW
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; } // NEW
    public void setModifiedBy(String modifiedBy) { this.modifiedBy = modifiedBy; } // NEW
    public void setCreatedOn(LocalDateTime createdOn) { this.createdOn = (createdOn != null) ? createdOn.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null; } // NEW
    public void setModifiedOn(LocalDateTime modifiedOn) { this.modifiedOn = (modifiedOn != null) ? modifiedOn.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null; } // NEW
}
