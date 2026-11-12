package com.manpower.dto;

import com.manpower.enums.TransactionStatus;
import com.manpower.enums.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class ContributionResponseDTO {
    
    private String id;
    private String memberId;
    private String memberName;
    private String memberPhone;
    private String memberEmail;
    private String groupId;
    private String groupName;
    private TransactionType transactionType;
    private BigDecimal amount;
    private LocalDate transactionDate;
    private String paymentMethod;
    private TransactionStatus status;
    private String description;
    
    // New tracking fields
    private LocalDate dueDate;
    private LocalDate paymentDate;
    private Boolean isLate;
    private Integer daysLate;
    private BigDecimal penaltyApplied;
    private LocalDate contributionPeriod;
    private Boolean reminderSent;
    
    // Constructors
    public ContributionResponseDTO() {}
    
    // Getters and Setters
    public String getId() {
        return id;
    }
    
    public void setId(String id) {
        this.id = id;
    }
    
    public String getMemberId() {
        return memberId;
    }
    
    public void setMemberId(String memberId) {
        this.memberId = memberId;
    }
    
    public String getMemberName() {
        return memberName;
    }
    
    public void setMemberName(String memberName) {
        this.memberName = memberName;
    }
    
    public String getMemberPhone() {
        return memberPhone;
    }
    
    public void setMemberPhone(String memberPhone) {
        this.memberPhone = memberPhone;
    }
    
    public String getMemberEmail() {
        return memberEmail;
    }
    
    public void setMemberEmail(String memberEmail) {
        this.memberEmail = memberEmail;
    }
    
    public String getGroupId() {
        return groupId;
    }
    
    public void setGroupId(String groupId) {
        this.groupId = groupId;
    }
    
    public String getGroupName() {
        return groupName;
    }
    
    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }
    
    public TransactionType getTransactionType() {
        return transactionType;
    }
    
    public void setTransactionType(TransactionType transactionType) {
        this.transactionType = transactionType;
    }
    
    public BigDecimal getAmount() {
        return amount;
    }
    
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
    
    public LocalDate getTransactionDate() {
        return transactionDate;
    }
    
    public void setTransactionDate(LocalDate transactionDate) {
        this.transactionDate = transactionDate;
    }
    
    public String getPaymentMethod() {
        return paymentMethod;
    }
    
    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }
    
    public TransactionStatus getStatus() {
        return status;
    }
    
    public void setStatus(TransactionStatus status) {
        this.status = status;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
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
}