package com.manpower.service;

import com.manpower.entity.Loan;
import com.manpower.entity.Member;
import com.manpower.entity.Group;
import com.manpower.entity.LoanDecisionLog;
import com.manpower.repository.LoanRepository;
import com.manpower.repository.MemberRepository;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.ContributionRepository;
import com.manpower.enums.MemberRole;
import com.manpower.enums.MemberStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.persistence.EntityNotFoundException;
import java.util.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

@Service
public class LoanService {

    @Autowired
    private LoanRepository loanRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private LoanDecisionLogService loanDecisionLogService;

    @Autowired
    private ContributionRepository contributionRepository;

    // ============ EXISTING METHODS (Keep all your current functionality) ============

    public List<Loan> getAllLoans() {
        return loanRepository.findAll();
    }

    public Optional<Loan> getLoanById(String id) {
        return loanRepository.findById(id);
    }

    // ============ ENHANCED saveLoan METHOD ============
    public Loan saveLoan(Loan loan) {
        // If this is an ML-approved loan, skip some validations and use ML data
        if (loan.getIsMlApproved() != null && loan.getIsMlApproved()) {
            return saveMlApprovedLoan(loan);
        }
        
        // Otherwise, use your existing validation logic
        return saveTraditionalLoan(loan);
    }

    /**
     * UPDATED METHOD: Save ML-approved loan with streamlined validation
     * NOW USING interest rate from frontend (which came from ML) instead of recalculating
     */
    private Loan saveMlApprovedLoan(Loan loan) {
        // 1. Validate ML decision reference
        if (loan.getMlDecisionLogId() == null) {
            throw new IllegalArgumentException("ML Decision Log ID is required for ML-approved loans.");
        }

        // 2. Verify the ML decision exists and is approved
        LoanDecisionLog mlDecision = loanDecisionLogService.getLatestDecisionForMember(loan.getMember().getId())
                .orElseThrow(() -> new EntityNotFoundException("No ML decision found for member " + loan.getMember().getId()));

        if (!mlDecision.getId().equals(loan.getMlDecisionLogId())) {
            throw new IllegalArgumentException("ML Decision Log ID does not match the latest decision for this member.");
        }

        if (!"APPROVE".equals(mlDecision.getFinalRecommendation()) && 
            !"APPROVE_WITH_CAUTION".equals(mlDecision.getFinalRecommendation())) {
            throw new IllegalArgumentException("ML decision is not approved. Current recommendation: " + mlDecision.getFinalRecommendation());
        }

        // 2.5 Validate guarantor if present
        if (loan.getGuarantor() != null && loan.getGuarantorAmount() != null) {
            // Check guarantor is not the borrower
            if (loan.getGuarantor().getId().equals(loan.getMember().getId())) {
                throw new IllegalArgumentException("A member cannot guarantee their own loan");
            }
            
            // Check guarantor has enough capacity
            validateGuarantor(loan.getGuarantor().getId(), loan.getGuarantorAmount());
        }

        // 3. Use the REQUESTED amount, not eligibility amount
        if (loan.getMlApprovedAmount() != null && loan.getMlApprovedAmount().compareTo(BigDecimal.ZERO) > 0) {
            loan.setAmount(loan.getMlApprovedAmount());
        } else {
            // Fallback to requested amount from ML decision
            loan.setAmount(BigDecimal.valueOf(mlDecision.getRequestedAmount()));
        }

        // 4. Set ML metadata
        loan.setMlRiskLevel(mlDecision.getLoanRisk());
        loan.setMlConfidenceScore(BigDecimal.valueOf(mlDecision.getFinalConfidence()));
        loan.setMlRecommendation(mlDecision.getFinalRecommendation());
        loan.setMlEligibilityConfidence(BigDecimal.valueOf(mlDecision.getEligibilityConfidence()));
        loan.setMlSentimentRisk(mlDecision.getSentimentRisk());
        loan.setMlDecisionReasoning(mlDecision.getDecisionReasoning());
        loan.setIsMlApproved(true);

        // 5. ✅ FIXED: Use the interest rate that came from the frontend (which came from ML)
        // DO NOT recalculate it! The frontend already extracted it from the ML decision.
        if (loan.getInterestRate() == null || loan.getInterestRate().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Interest rate must be provided for ML-approved loans. The rate from ML decision is required.");
        }
        
        // Log the rate being used (for debugging)
        System.out.println("✅ Using ML-provided interest rate: " + loan.getInterestRate() + "% for risk level: " + mlDecision.getLoanRisk());

        // 6. Use streamlined validation for ML-approved loans
        validateAndSetMlLoanRelationships(loan);

        // 7. Calculate financials using the interest rate from frontend (ML rate)
        calculateLoanFinancials(loan);

        // 8. Set metadata
        if (loan.getId() == null || loan.getId().trim().isEmpty()) {
            loan.setId(UUID.randomUUID().toString());
        }
        if (loan.getCreatedOn() == null) {
            loan.setCreatedOn(new Date());
        }
        loan.setModifiedOn(new Date());

        // 9. Save the loan
        Loan savedLoan = loanRepository.save(loan);

        // 10. Mark ML decision as used
        loanDecisionLogService.markDecisionAsUsed(mlDecision.getId());

        return savedLoan;
    }

    /**
     * EXISTING METHOD: Save traditional (non-ML) loan with full validation
     */
    private Loan saveTraditionalLoan(Loan loan) {
        // 1. Validate and assign member
        if (loan.getMember() == null || loan.getMember().getId() == null || loan.getMember().getId().trim().isEmpty()) {
            throw new IllegalArgumentException("Loan applicant member ID is required.");
        }
        Member applicantMember = memberRepository.findById(loan.getMember().getId())
                .orElseThrow(() -> new EntityNotFoundException("Loan applicant member with ID " + loan.getMember().getId() + " not found."));
        loan.setMember(applicantMember);

        // 2. Validate and assign group
        if (loan.getGroup() == null || loan.getGroup().getId() == null || loan.getGroup().getId().trim().isEmpty()) {
            throw new IllegalArgumentException("Loan group ID is required.");
        }
        Group loanGroup = groupRepository.findById(loan.getGroup().getId())
                .orElseThrow(() -> new EntityNotFoundException("Loan group with ID " + loan.getGroup().getId() + " not found."));
        loan.setGroup(loanGroup);

        // 3. Set 'approvedBy' logic
        if (loan.getId() == null && "PENDING".equalsIgnoreCase(loan.getStatus())) {
            Set<Member> groupMembers = loanGroup.getMembers();
            if (groupMembers == null || groupMembers.isEmpty()) {
                throw new EntityNotFoundException("No members found in group ID " + loanGroup.getId() + ". Cannot assign an admin for pending loan.");
            }

            Member groupAdmin = groupMembers.stream()
                    .filter(member -> MemberRole.GroupAdmin.equals(member.getRole()))
                    .findFirst()
                    .orElseThrow(() -> new EntityNotFoundException("No member with '" + MemberRole.GroupAdmin.name() + "' role found in group ID " + loanGroup.getId() + ". Cannot assign an admin for pending loan."));

            Member actualGroupAdmin = memberRepository.findById(groupAdmin.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Group admin member with ID " + groupAdmin.getId() + " found in group but not found in database (unexpected)."));

            loan.setApprovedBy(actualGroupAdmin);
        } else if (loan.getApprovedBy() != null && loan.getApprovedBy().getId() != null && !loan.getApprovedBy().getId().trim().isEmpty()) {
            Member explicitApprovedByMember = memberRepository.findById(loan.getApprovedBy().getId())
                    .orElseThrow(() -> new EntityNotFoundException("Approved by member with ID " + loan.getApprovedBy().getId() + " not found."));
            loan.setApprovedBy(explicitApprovedByMember);
        } else {
            throw new IllegalArgumentException("Approved by member is required and cannot be null for loan status " + loan.getStatus() + " or for existing loans.");
        }

        // 4. Calculate interest and balances
        calculateLoanFinancials(loan);
        
        // Ensure totalPaid is initialized to zero for a new loan
        if (loan.getId() == null || loan.getId().trim().isEmpty()) {
            loan.setTotalPaid(BigDecimal.ZERO);
        }

        // 5. Set metadata
        if (loan.getId() == null || loan.getId().trim().isEmpty()) {
            loan.setId(UUID.randomUUID().toString());
        }

        if (loan.getCreatedOn() == null) {
            loan.setCreatedOn(new Date());
        }

        loan.setModifiedOn(new Date());

        return loanRepository.save(loan);
    }

    /**
     * NEW METHOD: Streamlined validation for ML-approved loans
     */
    private void validateAndSetMlLoanRelationships(Loan loan) {
        // Validate member exists
        Member applicantMember = memberRepository.findById(loan.getMember().getId())
                .orElseThrow(() -> new EntityNotFoundException("Loan applicant member with ID " + loan.getMember().getId() + " not found."));
        loan.setMember(applicantMember);

        // Validate group exists
        Group loanGroup = groupRepository.findById(loan.getGroup().getId())
                .orElseThrow(() -> new EntityNotFoundException("Loan group with ID " + loan.getGroup().getId() + " not found."));
        loan.setGroup(loanGroup);
        
        // Validate guarantor exists if present
        if (loan.getGuarantor() != null && loan.getGuarantor().getId() != null) {
            Member guarantorMember = memberRepository.findById(loan.getGuarantor().getId())
                    .orElseThrow(() -> new EntityNotFoundException("Guarantor member with ID " + loan.getGuarantor().getId() + " not found."));
            loan.setGuarantor(guarantorMember);
        }

        // For ML-approved loans, auto-assign group admin as approver
        Set<Member> groupMembers = loanGroup.getMembers();
        if (groupMembers == null || groupMembers.isEmpty()) {
            throw new EntityNotFoundException("No members found in group ID " + loanGroup.getId() + ".");
        }

        Member groupAdmin = groupMembers.stream()
                .filter(member -> MemberRole.GroupAdmin.equals(member.getRole()))
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("No group admin found in group ID " + loanGroup.getId() + "."));

        Member actualGroupAdmin = memberRepository.findById(groupAdmin.getId())
                .orElseThrow(() -> new EntityNotFoundException("Group admin member with ID " + groupAdmin.getId() + " not found."));

        loan.setApprovedBy(actualGroupAdmin);
        if (loan.getGuarantor() != null && loan.getGuarantorAmount() != null && loan.getGuarantorAmount().compareTo(BigDecimal.ZERO) > 0) {
    loan.setStatus("PENDING_GUARANTOR");
    System.out.println("✅ Loan set to PENDING_GUARANTOR - waiting for guarantor: " + loan.getGuarantor().getId());
} else {
    loan.setStatus("APPROVED");
    System.out.println("✅ Loan set to APPROVED - no guarantor required");
}
    }

    /**
     * EXTRACTED METHOD: Calculate loan financials (used by both ML and traditional)
     */
    private void calculateLoanFinancials(Loan loan) {
        BigDecimal principal = loan.getAmount();
        BigDecimal annualRate = loan.getInterestRate();
        BigDecimal monthlyRate = annualRate.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(12), 6, RoundingMode.HALF_UP);

        LocalDate start = loan.getStartDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        LocalDate end = loan.getDueDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        long months = ChronoUnit.MONTHS.between(start, end);

        if (months <= 0) {
            throw new IllegalArgumentException("Due date must be at least 1 month after start date.");
        }

        BigDecimal interest = principal.multiply(monthlyRate).multiply(BigDecimal.valueOf(months)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalRepayable = principal.add(interest);

        loan.setCalculatedInterest(interest);
        loan.setOutstandingBalance(totalRepayable);
    }

    /**
     * UPDATED METHOD: Create loan directly from ML decision
     * Now expects the interest rate to be set by the frontend
     */
    public Loan createLoanFromMlDecision(String memberId, String groupId, Long mlDecisionLogId, BigDecimal interestRate) {
        // Get the ML decision
        LoanDecisionLog mlDecision = loanDecisionLogService.getLatestDecisionForMember(memberId)
                .orElseThrow(() -> new EntityNotFoundException("No ML decision found for member: " + memberId));

        if (!mlDecision.getId().equals(mlDecisionLogId)) {
            throw new IllegalArgumentException("ML Decision ID does not match latest decision for member");
        }

        if (!"APPROVE".equals(mlDecision.getFinalRecommendation()) && 
            !"APPROVE_WITH_CAUTION".equals(mlDecision.getFinalRecommendation())) {
            throw new IllegalArgumentException("Cannot create loan from non-approved ML decision: " + mlDecision.getFinalRecommendation());
        }

        // Create new loan with ML data
        Loan loan = new Loan();
        loan.setMember(memberRepository.findById(memberId)
                .orElseThrow(() -> new EntityNotFoundException("Member not found: " + memberId)));
        loan.setGroup(groupRepository.findById(groupId)
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId)));
        
        // Use the REQUESTED amount
        BigDecimal approvedAmount = BigDecimal.valueOf(mlDecision.getRequestedAmount());
        loan.setAmount(approvedAmount);
        loan.setMlApprovedAmount(approvedAmount);
        
        loan.setReason(mlDecision.getLoanReason());
        loan.setMlDecisionLogId(mlDecision.getId());
        loan.setMlRiskLevel(mlDecision.getLoanRisk());
        loan.setMlConfidenceScore(BigDecimal.valueOf(mlDecision.getFinalConfidence()));
        loan.setMlRecommendation(mlDecision.getFinalRecommendation());
        loan.setMlEligibilityConfidence(BigDecimal.valueOf(mlDecision.getEligibilityConfidence()));
        loan.setMlSentimentRisk(mlDecision.getSentimentRisk());
        loan.setMlDecisionReasoning(mlDecision.getDecisionReasoning());
        loan.setIsMlApproved(true);

        // Set dates (default to current date + 12 months)
        loan.setStartDate(new Date());
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.MONTH, 12);
        loan.setDueDate(cal.getTime());

        // ✅ FIXED: Use the interest rate provided by the frontend (which came from ML)
        if (interestRate == null || interestRate.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Interest rate must be provided from ML decision");
        }
        loan.setInterestRate(interestRate);

        // Save the loan (this will trigger financial calculations and validations)
        Loan savedLoan = saveLoan(loan);

        // Mark ML decision as used
        loanDecisionLogService.markDecisionAsUsed(mlDecision.getId());

        return savedLoan;
    }

    // ============ GUARANTOR METHODS ============

    /**
     * Calculate how much a member can guarantee based on their shares and existing commitments
     */
    public BigDecimal calculateGuarantorCapacity(String memberId) {
        // Get total shares from contributions
        BigDecimal totalShares = getMemberTotalShares(memberId);
        
        // Get member's own active loans (what they borrowed)
        BigDecimal activeLoans = getMemberActiveLoans(memberId);
        
        // Get member's existing guarantees (what they already guaranteed for others)
        BigDecimal existingGuarantees = loanRepository.getTotalGuaranteeAmountByGuarantorId(memberId);
        
        // Available capacity = Shares - Active Loans - Existing Guarantees
        BigDecimal availableCapacity = totalShares.subtract(activeLoans).subtract(existingGuarantees);
        
        // Cannot be negative
        return availableCapacity.max(BigDecimal.ZERO);
    }
    
    /**
     * Get member's total shares from contributions
     */
    private BigDecimal getMemberTotalShares(String memberId) {
        BigDecimal totalShares = contributionRepository.getTotalContributionsByMemberId(memberId);
        return totalShares != null ? totalShares : BigDecimal.ZERO;
    }
    
    /**
     * Get member's own active loans total outstanding balance
     */
    private BigDecimal getMemberActiveLoans(String memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new EntityNotFoundException("Member not found: " + memberId));
        
        List<Loan> activeLoans = loanRepository.findByMemberAndStatusIn(
            member,
            Arrays.asList("APPROVED", "ACTIVE", "PENDING", "PENDING_GUARANTOR")
        );
        
        return activeLoans.stream()
                .map(Loan::getOutstandingBalance)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    
    /**
 * Validate if a member can be a guarantor for a specific loan amount
 */
public boolean validateGuarantor(String guarantorId, BigDecimal guaranteeAmount) {
    BigDecimal availableCapacity = calculateGuarantorCapacity(guarantorId);
    
    if (guaranteeAmount.compareTo(availableCapacity) > 0) {
        throw new IllegalArgumentException(
            String.format("Guarantor only has KES %s available capacity. Requested guarantee: KES %s",
                availableCapacity.toString(), guaranteeAmount.toString())
        );
    }
    
    // Check guarantor is active
    Member guarantor = memberRepository.findById(guarantorId)
            .orElseThrow(() -> new EntityNotFoundException("Guarantor member not found"));
    
    if (guarantor.getStatus() != MemberStatus.Active) {
        throw new IllegalArgumentException("Guarantor must be an active member");
    }
    
    return true;
}
    
    /**
     * Get guarantor details with capacity for frontend
     */
    public Map<String, Object> getGuarantorInfo(String guarantorId) {
        Member guarantor = memberRepository.findById(guarantorId)
                .orElseThrow(() -> new EntityNotFoundException("Member not found: " + guarantorId));
        
        Map<String, Object> info = new HashMap<>();
        info.put("id", guarantor.getId());
        info.put("firstName", guarantor.getFirstName());
        info.put("lastName", guarantor.getLastName());
        info.put("email", guarantor.getEmail());
        info.put("phoneNumber", guarantor.getPhoneNumber());
        info.put("status", guarantor.getStatus());
        info.put("totalShares", getMemberTotalShares(guarantorId));
        info.put("activeLoans", getMemberActiveLoans(guarantorId));
        info.put("existingGuarantees", loanRepository.getTotalGuaranteeAmountByGuarantorId(guarantorId));
        info.put("availableCapacity", calculateGuarantorCapacity(guarantorId));
        
        return info;
    }

    // ============ NEW GUARANTOR ACCEPTANCE/DECLINE METHODS ============

    /**
     * Accept guarantee - called when a guarantor accepts their guarantee obligation
     */
    public Loan acceptGuarantee(String loanId, String guarantorId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan not found: " + loanId));
        
        if (!"PENDING_GUARANTOR".equals(loan.getStatus())) {
            throw new IllegalArgumentException("Loan is not waiting for guarantor acceptance. Current status: " + loan.getStatus());
        }
        
        if (loan.getGuarantor() == null || !loan.getGuarantor().getId().equals(guarantorId)) {
            throw new IllegalArgumentException("You are not the guarantor for this loan");
        }
        
        // Update loan status to APPROVED
        loan.setStatus("APPROVED");
        loan.setModifiedOn(new Date());
        
        System.out.println("✅ Guarantor " + guarantorId + " accepted loan " + loanId + " - Status changed to APPROVED");
        
        return loanRepository.save(loan);
    }

    /**
     * Decline guarantee - called when a guarantor declines their guarantee obligation
     */
    public Loan declineGuarantee(String loanId, String guarantorId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan not found: " + loanId));
        
        if (!"PENDING_GUARANTOR".equals(loan.getStatus())) {
            throw new IllegalArgumentException("Loan is not waiting for guarantor acceptance. Current status: " + loan.getStatus());
        }
        
        if (loan.getGuarantor() == null || !loan.getGuarantor().getId().equals(guarantorId)) {
            throw new IllegalArgumentException("You are not the guarantor for this loan");
        }
        
        // Update loan status to REJECTED (since guarantor declined)
        loan.setStatus("REJECTED");
        loan.setModifiedOn(new Date());
        
        System.out.println("❌ Guarantor " + guarantorId + " declined loan " + loanId + " - Status changed to REJECTED");
        
        return loanRepository.save(loan);
    }

    // ============ KEEP ALL YOUR EXISTING METHODS BELOW ============
    
    public Loan processPayment(String loanId, BigDecimal paymentAmount) {
        if (paymentAmount == null || paymentAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be a positive value.");
        }

        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan with ID " + loanId + " not found."));

        // Add the new payment to the totalPaid amount
        BigDecimal currentTotalPaid = loan.getTotalPaid();
        BigDecimal newTotalPaid = currentTotalPaid.add(paymentAmount);
        loan.setTotalPaid(newTotalPaid);

        // Subtract the payment from the outstanding balance
        BigDecimal currentOutstandingBalance = loan.getOutstandingBalance();
        BigDecimal newOutstandingBalance = currentOutstandingBalance.subtract(paymentAmount);
        
        // Ensure the outstanding balance doesn't go below zero
        if (newOutstandingBalance.compareTo(BigDecimal.ZERO) < 0) {
            newOutstandingBalance = BigDecimal.ZERO;
        }
        
        loan.setOutstandingBalance(newOutstandingBalance);

        // Update the loan status if it's fully paid
        if (newOutstandingBalance.compareTo(BigDecimal.ZERO) == 0) {
            loan.setStatus("PAID");
        }

        loan.setModifiedOn(new Date());

        return loanRepository.save(loan);
    }
    
    public Loan approveLoan(String loanId, String approverMemberId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan with ID " + loanId + " not found."));

        if (!"PENDING".equalsIgnoreCase(loan.getStatus())) {
            throw new IllegalArgumentException("Only PENDING loans can be approved. Current status: " + loan.getStatus());
        }

        Member actualApprover = memberRepository.findById(approverMemberId)
                .orElseThrow(() -> new EntityNotFoundException("Approving member with ID " + approverMemberId + " not found."));

        if (loan.getApprovedBy() == null || !loan.getApprovedBy().getId().equals(approverMemberId) || !MemberRole.GroupAdmin.equals(actualApprover.getRole())) {
            throw new SecurityException("Unauthorized: Only the assigned group admin with " + MemberRole.GroupAdmin.name() + " role can approve this loan.");
        }

        loan.setStatus("APPROVED");
        loan.setModifiedBy(actualApprover.getId());
        loan.setModifiedOn(new Date());

        return loanRepository.save(loan);
    }

    public Loan rejectLoan(String loanId, String rejecterMemberId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan with ID " + loanId + " not found."));

        if (!"PENDING".equalsIgnoreCase(loan.getStatus())) {
            throw new IllegalArgumentException("Only PENDING loans can be rejected. Current status: " + loan.getStatus());
        }

        Member actualRejecter = memberRepository.findById(rejecterMemberId)
                .orElseThrow(() -> new EntityNotFoundException("Rejecting member with ID " + rejecterMemberId + " not found."));

        if (loan.getApprovedBy() == null || !loan.getApprovedBy().getId().equals(rejecterMemberId) || !MemberRole.GroupAdmin.equals(actualRejecter.getRole())) {
            throw new SecurityException("Unauthorized: Only the assigned group admin with " + MemberRole.GroupAdmin.name() + " role can reject this loan.");
        }

        loan.setStatus("REJECTED");
        loan.setModifiedBy(actualRejecter.getId());
        loan.setModifiedOn(new Date());

        return loanRepository.save(loan);
    }

    public void deleteLoan(String id) {
        loanRepository.deleteById(id);
    }

    // ============ NEW ML-RELATED METHODS ============

    /**
     * Get ML-approved loans for a member
     */
    public List<Loan> getMlApprovedLoansByMember(String memberId) {
        return loanRepository.findByMemberIdAndIsMlApprovedTrue(memberId);
    }

    /**
     * Check if member has any ML-approved loans
     */
    public boolean hasMlApprovedLoans(String memberId) {
        return loanRepository.hasMlApprovedLoans(memberId);
    }

    /**
     * Get ML loan statistics - FIXED VERSION
     */
    public Map<String, Object> getMlLoanStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        try {
            // Get ML approval stats with null safety
            List<Object[]> approvalStats = loanRepository.countLoansByMlApproval();
            long mlApprovedLoans = 0;
            long traditionalLoans = 0;
            
            for (Object[] stat : approvalStats) {
                Boolean isMlApproved = stat[0] != null ? (Boolean) stat[0] : false;
                Long count = stat[1] != null ? (Long) stat[1] : 0L;
                
                if (isMlApproved) {
                    mlApprovedLoans = count;
                } else {
                    traditionalLoans = count;
                }
            }
            stats.put("mlApprovedLoans", mlApprovedLoans);
            stats.put("traditionalLoans", traditionalLoans);

            // Get risk distribution with null safety
            List<Object[]> riskStats = loanRepository.countMlApprovedLoansByRiskLevel();
            Map<String, Long> riskDistribution = new HashMap<>();
            for (Object[] stat : riskStats) {
                if (stat[0] != null && stat[1] != null) {
                    riskDistribution.put((String) stat[0], (Long) stat[1]);
                }
            }
            stats.put("riskDistribution", riskDistribution);

            // Get additional ML analytics from LoanDecisionLog
            Map<String, Object> decisionStats = loanDecisionLogService.getDecisionStatistics();
            stats.put("totalDecisions", decisionStats.get("totalDecisions"));
            stats.put("decisionsByType", decisionStats.get("decisionsByType"));
            stats.put("unusedDecisions", decisionStats.get("unusedDecisions"));

            return stats;
            
        } catch (Exception e) {
            // Return safe default values if there's an error
            stats.put("mlApprovedLoans", 0);
            stats.put("traditionalLoans", 0);
            stats.put("riskDistribution", new HashMap<>());
            stats.put("totalDecisions", 0);
            stats.put("decisionsByType", new HashMap<>());
            stats.put("unusedDecisions", 0);
            return stats;
        }
    }
}