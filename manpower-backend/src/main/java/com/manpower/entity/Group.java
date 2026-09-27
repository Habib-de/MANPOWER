package com.manpower.entity;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import java.io.Serializable;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "group_info")
public class Group implements Serializable {

    private static final long serialVersionUID = 1L;

    // ========== ENUMS ==========
    
    public enum ContributionFrequency {
        WEEKLY, MONTHLY
    }

    // ========== EXISTING FIELDS ==========

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(name = "id", nullable = false, length = 40)
    private String id;

    @Column(name = "groupName", nullable = false, length = 100)
    private String groupName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "creationDate", nullable = false)
    private Date creationDate;

    @Column(name = "created_by", length = 40)
    private String createdBy;

    @Column(name = "modified_by", length = 40)
    private String modifiedBy;

    @CreationTimestamp
    @Column(name = "created_on", updatable = false)
    private LocalDateTime createdOn;

    @UpdateTimestamp
    @Column(name = "modified_on")
    private LocalDateTime modifiedOn;

    @Column(name = "mansoft_tenant_id", length = 100)
    private String mansoftTenantId;

    @Column(name = "status", length = 20)
    private String status = "Active";

    // ========== MPESA FIELDS ==========
    
    @Column(name = "mpesa_consumer_key", length = 500)
    private String mpesaConsumerKey;
    
    @Column(name = "mpesa_consumer_secret", length = 500)
    private String mpesaConsumerSecret;
    
    @Column(name = "mpesa_business_shortcode", length = 20)
    private String mpesaBusinessShortcode;
    
    @Column(name = "mpesa_passkey", length = 500)
    private String mpesaPasskey;
    
    @Column(name = "mpesa_callback_url", length = 1000)
    private String mpesaCallbackUrl;
    
    @Column(name = "mpesa_is_active", columnDefinition = "boolean default true")
    private Boolean mpesaIsActive = true;
    
    @Column(name = "mpesa_last_configured")
    private LocalDateTime mpesaLastConfigured;

    // ========== NEW CONTRIBUTION SETTINGS FIELDS ==========
    
    @Enumerated(EnumType.STRING)
    @Column(name = "contribution_frequency")
    private ContributionFrequency contributionFrequency;
    
    @Column(name = "expected_contribution_amount")
    private BigDecimal expectedContributionAmount;
    
    @Column(name = "enable_penalty")
    private Boolean enablePenalty = false;
    
    @Column(name = "penalty_amount")
    private BigDecimal penaltyAmount;
    
    @Column(name = "grace_period_days")
    private Integer gracePeriodDays = 3;
    
    @Column(name = "enable_reminders")
    private Boolean enableReminders = true;
    
    @Column(name = "reminder_days_before")
    private Integer reminderDaysBefore = 2;
    
    @Column(name = "contribution_due_day")
    private Integer contributionDueDay; // 1-31 for monthly, 1-7 for weekly (1=Monday)
    
    @Column(name = "next_contribution_date")
    private LocalDate nextContributionDate;

    // ========== RELATIONSHIPS ==========

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private Set<Member> members = new HashSet<>();

    // ========== CONSTRUCTORS ==========
    
    public Group() {}

    // ========== EXISTING GETTERS & SETTERS ==========

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Date getCreationDate() {
        return creationDate;
    }

    public void setCreationDate(Date creationDate) {
        this.creationDate = creationDate;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getModifiedBy() {
        return modifiedBy;
    }

    public void setModifiedBy(String modifiedBy) {
        this.modifiedBy = modifiedBy;
    }

    public LocalDateTime getCreatedOn() {
        return createdOn;
    }

    public void setCreatedOn(LocalDateTime createdOn) {
        this.createdOn = createdOn;
    }

    public LocalDateTime getModifiedOn() {
        return modifiedOn;
    }

    public void setModifiedOn(LocalDateTime modifiedOn) {
        this.modifiedOn = modifiedOn;
    }

    public String getMansoftTenantId() {
        return mansoftTenantId;
    }

    public void setMansoftTenantId(String mansoftTenantId) {
        this.mansoftTenantId = mansoftTenantId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    // ========== MPESA GETTERS & SETTERS ==========
    
    public String getMpesaConsumerKey() {
        return mpesaConsumerKey;
    }

    public void setMpesaConsumerKey(String mpesaConsumerKey) {
        this.mpesaConsumerKey = mpesaConsumerKey;
    }

    public String getMpesaConsumerSecret() {
        return mpesaConsumerSecret;
    }

    public void setMpesaConsumerSecret(String mpesaConsumerSecret) {
        this.mpesaConsumerSecret = mpesaConsumerSecret;
    }

    public String getMpesaBusinessShortcode() {
        return mpesaBusinessShortcode;
    }

    public void setMpesaBusinessShortcode(String mpesaBusinessShortcode) {
        this.mpesaBusinessShortcode = mpesaBusinessShortcode;
    }

    public String getMpesaPasskey() {
        return mpesaPasskey;
    }

    public void setMpesaPasskey(String mpesaPasskey) {
        this.mpesaPasskey = mpesaPasskey;
    }

    public String getMpesaCallbackUrl() {
        return mpesaCallbackUrl;
    }

    public void setMpesaCallbackUrl(String mpesaCallbackUrl) {
        this.mpesaCallbackUrl = mpesaCallbackUrl;
    }

    public Boolean getMpesaIsActive() {
        return mpesaIsActive;
    }

    public void setMpesaIsActive(Boolean mpesaIsActive) {
        this.mpesaIsActive = mpesaIsActive;
    }

    public LocalDateTime getMpesaLastConfigured() {
        return mpesaLastConfigured;
    }

    public void setMpesaLastConfigured(LocalDateTime mpesaLastConfigured) {
        this.mpesaLastConfigured = mpesaLastConfigured;
    }

    // ========== NEW CONTRIBUTION SETTINGS GETTERS & SETTERS ==========
    
    public ContributionFrequency getContributionFrequency() {
        return contributionFrequency;
    }

    public void setContributionFrequency(ContributionFrequency contributionFrequency) {
        this.contributionFrequency = contributionFrequency;
    }

    public BigDecimal getExpectedContributionAmount() {
        return expectedContributionAmount;
    }

    public void setExpectedContributionAmount(BigDecimal expectedContributionAmount) {
        this.expectedContributionAmount = expectedContributionAmount;
    }

    public Boolean getEnablePenalty() {
        return enablePenalty;
    }

    public void setEnablePenalty(Boolean enablePenalty) {
        this.enablePenalty = enablePenalty;
    }

    public BigDecimal getPenaltyAmount() {
        return penaltyAmount;
    }

    public void setPenaltyAmount(BigDecimal penaltyAmount) {
        this.penaltyAmount = penaltyAmount;
    }

    public Integer getGracePeriodDays() {
        return gracePeriodDays;
    }

    public void setGracePeriodDays(Integer gracePeriodDays) {
        this.gracePeriodDays = gracePeriodDays;
    }

    public Boolean getEnableReminders() {
        return enableReminders;
    }

    public void setEnableReminders(Boolean enableReminders) {
        this.enableReminders = enableReminders;
    }

    public Integer getReminderDaysBefore() {
        return reminderDaysBefore;
    }

    public void setReminderDaysBefore(Integer reminderDaysBefore) {
        this.reminderDaysBefore = reminderDaysBefore;
    }

    public Integer getContributionDueDay() {
        return contributionDueDay;
    }

    public void setContributionDueDay(Integer contributionDueDay) {
        this.contributionDueDay = contributionDueDay;
    }

    public LocalDate getNextContributionDate() {
        return nextContributionDate;
    }

    public void setNextContributionDate(LocalDate nextContributionDate) {
        this.nextContributionDate = nextContributionDate;
    }

    // ========== RELATIONSHIP GETTERS & SETTERS ==========

    public Set<Member> getMembers() {
        return members;
    }

    public void setMembers(Set<Member> members) {
        this.members = members;
    }

    public void addMember(Member member) {
        this.members.add(member);
        member.setGroup(this);
    }

    public void removeMember(Member member) {
        this.members.remove(member);
        member.setGroup(null);
    }
}