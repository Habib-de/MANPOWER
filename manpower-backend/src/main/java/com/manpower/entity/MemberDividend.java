package com.manpower.entity;

import javax.persistence.*;
import java.math.BigDecimal;
import java.util.Date;

@Entity
@Table(name = "member_dividends")
public class MemberDividend {

    @Id
    @Column(name = "id", length = 40)
    private String id;

    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne
    @JoinColumn(name = "declaration_id", nullable = false)
    private DividendDeclaration declaration;

    @Column(name = "shares_amount", nullable = false)
    private BigDecimal sharesAmount;

    @Column(name = "dividend_amount", nullable = false)
    private BigDecimal dividendAmount;

    @Column(name = "payment_status", length = 20)
    private String paymentStatus; // PENDING, PAID, FAILED

    @Column(name = "payment_date")
    @Temporal(TemporalType.DATE)
    private Date paymentDate;

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    @ManyToOne
    @JoinColumn(name = "paid_by")
    private Member paidBy;

    @Column(name = "created_on", updatable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdOn = new Date();

    // Constructors
    public MemberDividend() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }

    public DividendDeclaration getDeclaration() { return declaration; }
    public void setDeclaration(DividendDeclaration declaration) { this.declaration = declaration; }

    public BigDecimal getSharesAmount() { return sharesAmount; }
    public void setSharesAmount(BigDecimal sharesAmount) { this.sharesAmount = sharesAmount; }

    public BigDecimal getDividendAmount() { return dividendAmount; }
    public void setDividendAmount(BigDecimal dividendAmount) { this.dividendAmount = dividendAmount; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public Date getPaymentDate() { return paymentDate; }
    public void setPaymentDate(Date paymentDate) { this.paymentDate = paymentDate; }

    public String getPaymentReference() { return paymentReference; }
    public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }

    public Member getPaidBy() { return paidBy; }
    public void setPaidBy(Member paidBy) { this.paidBy = paidBy; }

    public Date getCreatedOn() { return createdOn; }
    public void setCreatedOn(Date createdOn) { this.createdOn = createdOn; }
}