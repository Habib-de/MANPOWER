package com.manpower.service;

import com.manpower.entity.*;
import com.manpower.repository.*;
import com.manpower.enums.MemberStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityNotFoundException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DividendService {

    @Autowired
    private DividendDeclarationRepository declarationRepository;

    @Autowired
    private MemberDividendRepository memberDividendRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private ContributionRepository contributionRepository;

    // ============ DIVIDEND DECLARATIONS ============

    public List<DividendDeclaration> getAllDeclarations() {
        return declarationRepository.findAll();
    }

    // Get declarations by group
    public List<DividendDeclaration> getDeclarationsByGroup(String groupId) {
        return declarationRepository.findByGroupId(groupId);
    }

    public Optional<DividendDeclaration> getDeclarationById(String id) {
        return declarationRepository.findById(id);
    }

    public DividendDeclaration createDeclaration(DividendDeclaration declaration) {
        if (declaration.getId() == null) {
            declaration.setId(UUID.randomUUID().toString());
        }
        declaration.setStatus("DRAFT");
        declaration.setCreatedOn(new Date());
        return declarationRepository.save(declaration);
    }

    public DividendDeclaration approveDeclaration(String declarationId, String approverId) {
        DividendDeclaration declaration = declarationRepository.findById(declarationId)
                .orElseThrow(() -> new EntityNotFoundException("Declaration not found"));

        Member approver = memberRepository.findById(approverId)
                .orElseThrow(() -> new EntityNotFoundException("Approver not found"));

        if (!"DRAFT".equals(declaration.getStatus())) {
            throw new IllegalStateException("Only DRAFT declarations can be approved");
        }

        declaration.setStatus("APPROVED");
        declaration.setApprovedBy(approver);
        declaration.setApprovedDate(new Date());

        DividendDeclaration saved = declarationRepository.save(declaration);

        // Calculate dividends for all members in this group
        calculateDividendsForAllMembers(declaration.getId());

        return saved;
    }

    // Get current approved declaration by group
    public DividendDeclaration getCurrentApprovedDeclarationByGroup(String groupId) {
        return declarationRepository.findLatestApprovedDeclarationByGroup(groupId).orElse(null);
    }

    // Keep for backward compatibility
    public DividendDeclaration getCurrentApprovedDeclaration() {
        return declarationRepository.findLatestApprovedDeclaration().orElse(null);
    }

    // ============ DIVIDEND CALCULATION ============

    @Transactional
    public void calculateDividendsForAllMembers(String declarationId) {
        DividendDeclaration declaration = declarationRepository.findById(declarationId)
                .orElseThrow(() -> new EntityNotFoundException("Declaration not found"));

        if (!"APPROVED".equals(declaration.getStatus())) {
            throw new IllegalStateException("Can only calculate dividends for APPROVED declarations");
        }

        // Get the group ID from the declaration
        String groupId = declaration.getGroup() != null ? declaration.getGroup().getId() : null;
        
        // Get active members - filter by group if groupId exists
        List<Member> activeMembers = memberRepository.findAll().stream()
                .filter(m -> m.getStatus() == MemberStatus.Active)
                .filter(m -> groupId == null || (m.getGroup() != null && m.getGroup().getId().equals(groupId)))
                .collect(Collectors.toList());

        BigDecimal percentageRate = declaration.getPercentageRate();
        
        LocalDate startDate = getStartDateForFinancialYear(declaration.getFinancialYear());
        LocalDate endDate = getEndDateForFinancialYear(declaration.getFinancialYear());

        for (Member member : activeMembers) {
            BigDecimal totalShares = getMemberTotalSharesForYear(member.getId(), startDate, endDate);
            
            if (totalShares.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal dividendAmount = totalShares.multiply(percentageRate)
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

                List<MemberDividend> existing = memberDividendRepository.findByMemberId(member.getId());
                boolean alreadyExists = existing.stream()
                        .anyMatch(md -> md.getDeclaration().getId().equals(declarationId));

                if (!alreadyExists) {
                    MemberDividend memberDividend = new MemberDividend();
                    memberDividend.setId(UUID.randomUUID().toString());
                    memberDividend.setMember(member);
                    memberDividend.setDeclaration(declaration);
                    memberDividend.setSharesAmount(totalShares);
                    memberDividend.setDividendAmount(dividendAmount);
                    memberDividend.setPaymentStatus("PENDING");

                    memberDividendRepository.save(memberDividend);
                }
            }
        }
    }

    private LocalDate getStartDateForFinancialYear(String financialYear) {
        int year = Integer.parseInt(financialYear);
        return LocalDate.of(year, 1, 1);
    }

    private LocalDate getEndDateForFinancialYear(String financialYear) {
        int year = Integer.parseInt(financialYear);
        return LocalDate.of(year, 12, 31);
    }

    private BigDecimal getMemberTotalSharesForYear(String memberId, LocalDate startDate, LocalDate endDate) {
        return contributionRepository.getTotalContributionsByMemberIdAndDateRange(memberId, startDate, endDate);
    }

    @SuppressWarnings("unused")
    private BigDecimal getMemberTotalShares(String memberId) {
        return contributionRepository.getTotalContributionsByMemberId(memberId);
    }

    // ============ MEMBER DIVIDENDS (GROUP-BASED) ============

    public List<MemberDividend> getDividendsByMember(String memberId) {
        return memberDividendRepository.findByMemberId(memberId);
    }

    public List<MemberDividend> getDividendsByMemberAndGroup(String memberId, String groupId) {
        return memberDividendRepository.findByMemberIdAndGroupId(memberId, groupId);
    }

    public List<MemberDividend> getPendingDividendsByMember(String memberId) {
        return memberDividendRepository.findByMemberIdAndPaymentStatus(memberId, "PENDING");
    }

    public List<MemberDividend> getPendingDividendsByMemberAndGroup(String memberId, String groupId) {
        return memberDividendRepository.findByMemberIdAndGroupIdAndPaymentStatus(memberId, groupId, "PENDING");
    }

    public List<MemberDividend> getPaidDividendsByMember(String memberId) {
        return memberDividendRepository.findByMemberIdAndPaymentStatus(memberId, "PAID");
    }

    public List<MemberDividend> getPaidDividendsByMemberAndGroup(String memberId, String groupId) {
        return memberDividendRepository.findByMemberIdAndGroupIdAndPaymentStatus(memberId, groupId, "PAID");
    }

    public List<MemberDividend> getPendingPayments() {
        return memberDividendRepository.findByPaymentStatus("PROCESSING");
    }

    // Get pending payments by group
    public List<MemberDividend> getPendingPaymentsByGroup(String groupId) {
        return memberDividendRepository.findByGroupIdAndPaymentStatus(groupId, "PROCESSING");
    }

    public BigDecimal getTotalDividendsPaidToMember(String memberId) {
        return memberDividendRepository.getTotalDividendsPaidByMemberId(memberId);
    }

    public BigDecimal getTotalDividendsPaidToMemberAndGroup(String memberId, String groupId) {
        return memberDividendRepository.getTotalDividendsPaidByMemberIdAndGroupId(memberId, groupId);
    }

    // ============ DIVIDEND PAYMENT REQUESTS ============

    @Transactional
    public MemberDividend requestPayment(String dividendId, String paymentMethod) {
        MemberDividend dividend = memberDividendRepository.findById(dividendId)
                .orElseThrow(() -> new EntityNotFoundException("Dividend not found"));

        if (!"PENDING".equals(dividend.getPaymentStatus())) {
            throw new IllegalStateException("This dividend is not pending payment");
        }

        dividend.setPaymentStatus("PROCESSING");
        
        return memberDividendRepository.save(dividend);
    }

    @Transactional
    public MemberDividend processPayment(String dividendId, String adminId, String paymentReference) {
        MemberDividend dividend = memberDividendRepository.findById(dividendId)
                .orElseThrow(() -> new EntityNotFoundException("Dividend not found"));

        Member admin = memberRepository.findById(adminId)
                .orElseThrow(() -> new EntityNotFoundException("Admin not found"));

        if (!"PROCESSING".equals(dividend.getPaymentStatus()) && !"PENDING".equals(dividend.getPaymentStatus())) {
            throw new IllegalStateException("Cannot process payment for dividend with status: " + dividend.getPaymentStatus());
        }

        dividend.setPaymentStatus("PAID");
        dividend.setPaymentDate(new Date());
        dividend.setPaymentReference(paymentReference);
        dividend.setPaidBy(admin);

        return memberDividendRepository.save(dividend);
    }
}