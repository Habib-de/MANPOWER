package com.manpower.repository;

import com.manpower.entity.MemberDividend;
import com.manpower.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;


@Repository
public interface MemberDividendRepository extends JpaRepository<MemberDividend, String> {

    // Find dividends for a specific member
    List<MemberDividend> findByMember(Member member);

    // Find dividends by member ID
    List<MemberDividend> findByMemberId(String memberId);

    // Find pending dividends for a member
    List<MemberDividend> findByMemberIdAndPaymentStatus(String memberId, String paymentStatus);

    // Find dividends by declaration
    List<MemberDividend> findByDeclarationId(String declarationId);

    // Find pending dividends by declaration
    List<MemberDividend> findByDeclarationIdAndPaymentStatus(String declarationId, String paymentStatus);

    // Calculate total dividends paid to a member
    @Query("SELECT COALESCE(SUM(md.dividendAmount), 0) FROM MemberDividend md WHERE md.member.id = ?1 AND md.paymentStatus = 'PAID'")
    BigDecimal getTotalDividendsPaidByMemberId(String memberId);

    // Find unpaid dividends for a member
    @Query("SELECT md FROM MemberDividend md WHERE md.member.id = ?1 AND md.paymentStatus = 'PENDING'")
    List<MemberDividend> findUnpaidDividendsByMemberId(String memberId);

    @Query("SELECT md FROM MemberDividend md WHERE md.declaration.group.id = :groupId AND md.paymentStatus = :status")
    List<MemberDividend> findByGroupIdAndPaymentStatus(@Param("groupId") String groupId, @Param("status") String status);

    List<MemberDividend> findByPaymentStatus(String paymentStatus);

    // ============ ADD THESE GROUP-BASED METHODS ============
    
    // Get member dividends filtered by group
    @Query("SELECT md FROM MemberDividend md WHERE md.member.id = :memberId AND md.declaration.group.id = :groupId")
    List<MemberDividend> findByMemberIdAndGroupId(@Param("memberId") String memberId, @Param("groupId") String groupId);
    
    // Get pending dividends for a member filtered by group
    @Query("SELECT md FROM MemberDividend md WHERE md.member.id = :memberId AND md.declaration.group.id = :groupId AND md.paymentStatus = :status")
    List<MemberDividend> findByMemberIdAndGroupIdAndPaymentStatus(@Param("memberId") String memberId, @Param("groupId") String groupId, @Param("status") String status);
    
    // Get total dividends paid to a member filtered by group
    @Query("SELECT COALESCE(SUM(md.dividendAmount), 0) FROM MemberDividend md WHERE md.member.id = :memberId AND md.declaration.group.id = :groupId AND md.paymentStatus = 'PAID'")
    BigDecimal getTotalDividendsPaidByMemberIdAndGroupId(@Param("memberId") String memberId, @Param("groupId") String groupId);
}