package com.manpower.entity;

import com.manpower.enums.TransactionType;
import com.manpower.enums.TransactionStatus;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "contributions")
public class Contribution implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(name = "id", nullable = false, length = 40)
    private String id;

    @NotNull(message = "Member cannot be null")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @NotNull(message = "Group cannot be null")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "volunteer_campaign_id")
    private VolunteerCampaign volunteerCampaign;

    @NotNull(message = "Transaction type cannot be null")
    @Enumerated(EnumType.STRING)
    @Column(name = "transactionType", nullable = false, length = 20)
    private TransactionType transactionType;

    @NotNull(message = "Amount cannot be null")
    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @NotNull(message = "Transaction date cannot be null")
    @Column(name = "transactionDate")
    private LocalDate transactionDate;

    @NotBlank(message = "Payment method cannot be empty")
    @Column(name = "paymentMethod", length = 50)
    private String paymentMethod;

    @NotNull(message = "Status cannot be null")
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private TransactionStatus status = TransactionStatus.Completed;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @NotBlank(message = "Created by cannot be empty")
    @Column(name = "created_by", length = 40)
    private String createdBy;

    @NotBlank(message = "Modified by cannot be empty")
    @Column(name = "modified_by", length = 40)
    private String modifiedBy;

    @CreationTimestamp
    @Column(name = "created_on", updatable = false)
    private LocalDateTime createdOn;

    @UpdateTimestamp
    @Column(name = "modified_on")
    private LocalDateTime modifiedOn;

    @NotBlank(message = "Mansoft tenant ID cannot be empty")
    @Column(name = "mansoft_tenant_id", length = 100)
    private String mansoftTenantId;

    // ========== NEW FIELDS FOR CONTRIBUTION TRACKING & PENALTIES ==========
    
    @Column(name = "due_date")
    private LocalDate dueDate;
    
    @Column(name = "payment_date")
    private LocalDate paymentDate;
    
    @Column(name = "is_late")
    private Boolean isLate = false;
    
    @Column(name = "days_late")
    private Integer daysLate = 0;
    
    @Column(name = "penalty_applied")
    private BigDecimal penaltyApplied = BigDecimal.ZERO;
    
    @Column(name = "contribution_period")
    private LocalDate contributionPeriod;
    
    @Column(name = "reminder_sent")
    private Boolean reminderSent = false;
    
    @Column(name = "reminder_sent_date")
    private LocalDateTime reminderSentDate;
    
    @Column(name = "penalty_processed")
    private Boolean penaltyProcessed = false;

    // ========== Constructors ==========
    
    public Contribution() {
    }

    public Contribution(Member member, Group group, TransactionType transactionType, BigDecimal amount,
                        LocalDate transactionDate, String paymentMethod, String createdBy, String mansoftTenantId) {
        this.member = member;
        this.group = group;
        this.transactionType = transactionType;
        this.amount = amount;
        this.transactionDate = transactionDate;
        this.paymentMethod = paymentMethod;
        this.createdBy = createdBy;
        this.modifiedBy = createdBy;
        this.mansoftTenantId = mansoftTenantId;
        this.status = TransactionStatus.Completed;
    }

    // ========== Existing Getters and Setters ==========
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public VolunteerCampaign getVolunteerCampaign() { 
        return volunteerCampaign; 
    }
    
    public void setVolunteerCampaign(VolunteerCampaign volunteerCampaign) { 
        this.volunteerCampaign = volunteerCampaign; 
    }

    public TransactionType getTransactionType() { return transactionType; }
    public void setTransactionType(TransactionType transactionType) { this.transactionType = transactionType; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public LocalDate getTransactionDate() { return transactionDate; }
    public void setTransactionDate(LocalDate transactionDate) { this.transactionDate = transactionDate; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public TransactionStatus getStatus() { return status; }
    public void setStatus(TransactionStatus status) { this.status = status; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

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

    // ========== NEW GETTERS AND SETTERS FOR TRACKING FIELDS ==========
    
    public LocalDate getDueDate() {
        return dueDate;
    }
    
    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }
    
    public LocalDate getPaymentDate() {
        return paymentDate;
    }
    
    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }
    
    public Boolean getIsLate() {
        return isLate;
    }
    
    public void setIsLate(Boolean isLate) {
        this.isLate = isLate;
    }
    
    public Integer getDaysLate() {
        return daysLate;
    }
    
    public void setDaysLate(Integer daysLate) {
        this.daysLate = daysLate;
    }
    
    public BigDecimal getPenaltyApplied() {
        return penaltyApplied;
    }
    
    public void setPenaltyApplied(BigDecimal penaltyApplied) {
        this.penaltyApplied = penaltyApplied;
    }
    
    public LocalDate getContributionPeriod() {
        return contributionPeriod;
    }
    
    public void setContributionPeriod(LocalDate contributionPeriod) {
        this.contributionPeriod = contributionPeriod;
    }
    
    public Boolean getReminderSent() {
        return reminderSent;
    }
    
    public void setReminderSent(Boolean reminderSent) {
        this.reminderSent = reminderSent;
    }
    
    public LocalDateTime getReminderSentDate() {
        return reminderSentDate;
    }
    
    public void setReminderSentDate(LocalDateTime reminderSentDate) {
        this.reminderSentDate = reminderSentDate;
    }
    
    public Boolean getPenaltyProcessed() {
        return penaltyProcessed;
    }
    
    public void setPenaltyProcessed(Boolean penaltyProcessed) {
        this.penaltyProcessed = penaltyProcessed;
    }
    
    // ========== HELPER METHODS ==========
    
    /**
     * Check if this contribution is late based on due date and payment date
     */
    public boolean calculateIsLate() {
        if (dueDate == null) return false;
        if (paymentDate != null) {
            return paymentDate.isAfter(dueDate);
        }
        return LocalDate.now().isAfter(dueDate);
    }
    
    /**
     * Calculate how many days late this contribution is
     */
    public int calculateDaysLate() {
        if (dueDate == null) return 0;
        LocalDate referenceDate = paymentDate != null ? paymentDate : LocalDate.now();
        if (referenceDate.isAfter(dueDate)) {
            return (int) java.time.temporal.ChronoUnit.DAYS.between(dueDate, referenceDate);
        }
        return 0;
    }
}