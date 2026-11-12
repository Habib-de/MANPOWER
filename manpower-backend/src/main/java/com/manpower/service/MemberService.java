package com.manpower.service;

import com.manpower.entity.Member;
import java.util.List;
import java.util.Optional;

// CRITICAL FIX: This MUST be an 'interface'
public interface MemberService {
    // Basic CRUD
    Member saveMember(Member member);
    List<Member> getAllMembers();
    Optional<Member> getMemberById(String id);
    Member updateMember(String id, Member memberDetails);
    void deleteMember(String id);

    // NEW: Method for password reset
    String resetPassword(String email);

    // ✅ NEW: Get members by groupId
    List<Member> findByGroupId(String groupId);
}
