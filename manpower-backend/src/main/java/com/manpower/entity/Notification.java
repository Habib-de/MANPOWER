package com.manpower.entity;

import javax.persistence.*;
import java.io.Serializable;
import java.util.Date;

@Entity
@Table(name = "notifications")
public class Notification implements Serializable {

    @Id
    @Column(name = "id", nullable = false, length = 40)
    private String id;

    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false)
    private Member member; // Assuming you have a Member entity

    @Column(name = "type", length = 50)
    private String type;

    @Column(name = "messageContent", columnDefinition = "TEXT")
    private String messageContent;

    @Column(name = "sendDate")
    @Temporal(TemporalType.DATE)
    private Date sendDate;

    @Column(name = "channel", length = 50)
    private String channel;

    @Column(name = "is_read", nullable = false) // Added this field
    private boolean isRead;

    @Column(name = "created_by", length = 40)
    private String createdBy;

    @Column(name = "modified_by", length = 40)
    private String modifiedBy;

    @Column(name = "created_on", updatable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdOn = new Date();

    @Column(name = "modified_on")
    @Temporal(TemporalType.TIMESTAMP)
    private Date modifiedOn = new Date();

    @Column(name = "mansoft_tenant_id", length = 100)
    private String mansoftTenantId;

    // === NEW FIELDS FOR GROUP CHAT ===
    @Column(name = "group_id", length = 40)
    private String groupId; // For grouping notifications by group

    @Column(name = "parent_id", length = 40)
    private String parentId; // For comment threads (null = original post)

    @Column(name = "title", length = 255)
    private String title; // For post titles

    @Column(name = "sender_name", length = 100)
    private String senderName; // To display who sent the message

    // Getters and Setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Member getMember() {
        return member;
    }

    public void setMember(Member member) {
        this.member = member;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMessageContent() {
        return messageContent;
    }

    public void setMessageContent(String messageContent) {
        this.messageContent = messageContent;
    }

    public Date getSendDate() {
        return sendDate;
    }

    public void setSendDate(Date sendDate) {
        this.sendDate = sendDate;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    // Getter and Setter for isRead
    public boolean isRead() {
        return isRead;
    }

    public void setRead(boolean read) {
        isRead = read;
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

    public Date getCreatedOn() {
        return createdOn;
    }

    public void setCreatedOn(Date createdOn) {
        this.createdOn = createdOn;
    }

    public Date getModifiedOn() {
        return modifiedOn;
    }

    public void setModifiedOn(Date modifiedOn) {
        this.modifiedOn = modifiedOn;
    }

    public String getMansoftTenantId() {
        return mansoftTenantId;
    }

    public void setMansoftTenantId(String mansoftTenantId) {
        this.mansoftTenantId = mansoftTenantId;
    }

    // === NEW GETTERS AND SETTERS ===
    
    public String getGroupId() {
        return groupId;
    }

    public void setGroupId(String groupId) {
        this.groupId = groupId;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }
}