package com.manpower.entity;

import javax.persistence.*;
import java.math.BigDecimal;
import java.util.Date;

@Entity
@Table(name = "dividend_declarations")
public class DividendDeclaration {

    @Id
    @Column(name = "id", length = 40)
    private String id;

    // ✅ ADD THIS - Group field
    @ManyToOne
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @Column(name = "financial_year", length = 10, nullable = false)
    private String financialYear;

    @Column(name = "percentage_rate", nullable = false)
    private BigDecimal percentageRate;

    @Column(name = "declared_date", nullable = false)
    @Temporal(TemporalType.DATE)
    private Date declaredDate;

    @ManyToOne
    @JoinColumn(name = "approved_by")
    private Member approvedBy;

    @Column(name = "approved_date")
    @Temporal(TemporalType.DATE)
    private Date approvedDate;

    @Column(name = "status", length = 20)
    private String status; // DRAFT, APPROVED, PAID

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_on", updatable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdOn = new Date();

    // Constructors
    public DividendDeclaration() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    // ✅ ADD THIS getter and setter
    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public String getFinancialYear() { return financialYear; }
    public void setFinancialYear(String financialYear) { this.financialYear = financialYear; }

    public BigDecimal getPercentageRate() { return percentageRate; }
    public void setPercentageRate(BigDecimal percentageRate) { this.percentageRate = percentageRate; }

    public Date getDeclaredDate() { return declaredDate; }
    public void setDeclaredDate(Date declaredDate) { this.declaredDate = declaredDate; }

    public Member getApprovedBy() { return approvedBy; }
    public void setApprovedBy(Member approvedBy) { this.approvedBy = approvedBy; }

    public Date getApprovedDate() { return approvedDate; }
    public void setApprovedDate(Date approvedDate) { this.approvedDate = approvedDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Date getCreatedOn() { return createdOn; }
    public void setCreatedOn(Date createdOn) { this.createdOn = createdOn; }
}