package com.manpower.entity;

import javax.persistence.*;
import javax.validation.constraints.*;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "meetings")
public class Meeting implements Serializable {

    @Id
    @Column(length = 40)
    private String id;

    @ManyToOne
    @JoinColumn(name = "group_id", nullable = true) // Nullable for SuperAdmin
    private Group group;

    @NotNull(message = "Meeting date is required.")
    @Column(name = "meetingDate")
    private LocalDate meetingDate;

    @NotNull(message = "Meeting time is required.")
    @Column(name = "meetingTime")
    private LocalTime meetingTime;

    @NotBlank(message = "Meeting link is required.")
    @Size(max = 255)
    @Column(name = "meetingLink", length = 255)
    private String meetingLink;

    @NotBlank(message = "Title is required.")
    @Size(max = 150)
    @Column(name = "title", length = 150)
    private String title;

    @NotBlank(message = "Agenda is required.")
    @Column(name = "agenda", columnDefinition = "TEXT")
    private String agenda;

    @NotBlank(message = "CalledByRole is required.")
    @Size(max = 20)
    @Column(name = "called_by_role", length = 20)
    private String calledByRole;

    @NotBlank(message = "TargetAudience is required.")
    @Size(max = 30)
    @Column(name = "target_audience", length = 30)
    private String targetAudience;

    @Column(name = "created_by", length = 40)
    private String createdBy;

    @Column(name = "modified_by", length = 40)
    private String modifiedBy;

    @Column(name = "created_on")
    private LocalDateTime createdOn;

    @Column(name = "modified_on")
    private LocalDateTime modifiedOn;

    @Column(name = "mansoft_tenant_id", length = 100)
    private String mansoftTenantId;

    // === Lifecycle Hooks ===
    @PrePersist
    public void onCreate() {
        if (this.id == null || this.id.isEmpty()) {
            this.id = UUID.randomUUID().toString();
        }
        this.createdOn = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.modifiedOn = LocalDateTime.now();
    }

    // === Getters and Setters ===

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public LocalDate getMeetingDate() { return meetingDate; }
    public void setMeetingDate(LocalDate meetingDate) { this.meetingDate = meetingDate; }

    public LocalTime getMeetingTime() { return meetingTime; }
    public void setMeetingTime(LocalTime meetingTime) { this.meetingTime = meetingTime; }

    public String getMeetingLink() { return meetingLink; }
    public void setMeetingLink(String meetingLink) { this.meetingLink = meetingLink; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getAgenda() { return agenda; }
    public void setAgenda(String agenda) { this.agenda = agenda; }

    public String getCalledByRole() { return calledByRole; }
    public void setCalledByRole(String calledByRole) { this.calledByRole = calledByRole; }

    public String getTargetAudience() { return targetAudience; }
    public void setTargetAudience(String targetAudience) { this.targetAudience = targetAudience; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getModifiedBy() { return modifiedBy; }
    public void setModifiedBy(String modifiedBy) { this.modifiedBy = modifiedBy; }

    public LocalDateTime getCreatedOn() { return createdOn; }
    public void setCreatedOn(LocalDateTime createdOn) { this.createdOn = createdOn; }

    public LocalDateTime getModifiedOn() { return modifiedOn; }
    public void setModifiedOn(LocalDateTime modifiedOn) { this.modifiedOn = modifiedOn; }

    public String getMansoftTenantId() { return mansoftTenantId; }
    public void setMansoftTenantId(String mansoftTenantId) { this.mansoftTenantId = mansoftTenantId; }
}
