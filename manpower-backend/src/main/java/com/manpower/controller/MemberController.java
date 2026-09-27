package com.manpower.controller;

import com.manpower.entity.Member;
import com.manpower.service.MemberService;
import com.manpower.dto.ErrorResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Optional;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.101:8081"}) // ✅ Updated to match frontend
@RestController
@RequestMapping("/api/members")
public class MemberController {

    @Autowired
    private MemberService memberService;

    @PostMapping
    public ResponseEntity<Object> createMember(@Valid @RequestBody Member member) {
        try {
            Member savedMember = memberService.saveMember(member);
            return new ResponseEntity<>(savedMember, HttpStatus.CREATED);
        } catch (RuntimeException e) {
            if (e.getMessage().contains("SuperAdmin already exists")) {
                return new ResponseEntity<>(new ErrorResponse(e.getMessage(), "SUPERADMIN_EXISTS"), HttpStatus.CONFLICT);
            }
            return new ResponseEntity<>(new ErrorResponse("An unexpected error occurred: " + e.getMessage(), "INTERNAL_ERROR"), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping
    public List<Member> getAllMembers() {
        return memberService.getAllMembers();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Member> getMemberById(@PathVariable String id) {
        Optional<Member> member = memberService.getMemberById(id);
        return member.map(value -> new ResponseEntity<>(value, HttpStatus.OK))
                     .orElseGet(() -> new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Object> updateMember(@PathVariable String id, @Valid @RequestBody Member memberDetails) {
        try {
            Member updatedMember = memberService.updateMember(id, memberDetails);
            return new ResponseEntity<>(updatedMember, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.NOT_FOUND);
        } catch (RuntimeException e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to update member: " + e.getMessage(), "UPDATE_ERROR"), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMember(@PathVariable String id) {
        memberService.deleteMember(id);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    // ✅ NEW: Get all members by groupId
    @GetMapping("/by-group/{groupId}")
    public ResponseEntity<List<Member>> getMembersByGroup(@PathVariable String groupId) {
        List<Member> members = memberService.findByGroupId(groupId);
        return new ResponseEntity<>(members, HttpStatus.OK);
    }
}
