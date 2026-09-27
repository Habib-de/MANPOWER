# member-churn-predictor/features.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

class MemberChurnFeatureEngineer:
    def __init__(self):
        self.feature_names = None
        
    def create_features(self, members_df, contributions_df, loans_df, notifications_df, 
                       group_settings_df=None, as_of_date=None):
        """
        Create features for member churn prediction
        """
        if as_of_date is None:
            as_of_date = datetime.now()
        
        print(f"📅 Creating features as of {as_of_date.date()}")
        
        # Convert dates
        members_df['joinDate'] = pd.to_datetime(members_df['joinDate'])
        contributions_df['transactionDate'] = pd.to_datetime(contributions_df['transactionDate'])
        
        # Convert new contribution fields if they exist
        if 'dueDate' in contributions_df.columns:
            contributions_df['dueDate'] = pd.to_datetime(contributions_df['dueDate'])
        if 'paymentDate' in contributions_df.columns:
            contributions_df['paymentDate'] = pd.to_datetime(contributions_df['paymentDate'])
            
        loans_df['startDate'] = pd.to_datetime(loans_df['startDate'])
        notifications_df['sendDate'] = pd.to_datetime(notifications_df['sendDate'])
        
        features_list = []
        
        for _, member in members_df.iterrows():
            member_id = member['id']
            
            # Filter data for this member
            member_contribs = contributions_df[contributions_df['member_id'] == member_id]
            member_loans = loans_df[loans_df['member_id'] == member_id]
            member_notifs = notifications_df[notifications_df['member_id'] == member_id]
            
            # Get member's group settings (frequency, expected amount)
            member_group_settings = None
            if group_settings_df is not None and 'group_id' in member:
                member_group_settings = group_settings_df[group_settings_df['group_id'] == member.get('group_id')]
            
            # Calculate features
            features = self._calculate_member_features(
                member, member_contribs, member_loans, member_notifs, 
                member_group_settings, as_of_date
            )
            features_list.append(features)
        
        features_df = pd.DataFrame(features_list)
        self.feature_names = [f for f in features_df.columns if f != 'member_id']
        
        return features_df
    
    def _calculate_member_features(self, member, contribs, loans, notifs, group_settings, as_of_date):
        """Calculate ALL features for one member"""
        features = {}
        
        # ========== 1. DEMOGRAPHIC FEATURES ==========
        features['member_id'] = member['id']
        join_date = member['joinDate']
        features['membership_days'] = (as_of_date - join_date).days
        features['membership_months'] = max(0, features['membership_days'] / 30.44)
        
        # Encode role
        role_map = {'Member': 0, 'GroupAdmin': 1, 'SuperAdmin': 2}
        features['role_encoded'] = role_map.get(member['role'], 0)
        
        # ========== 2. CONTRIBUTION FEATURES (EXISTING) ==========
        # Filter contributions before as_of_date
        past_contribs = contribs[contribs['transactionDate'] <= as_of_date]
        
        if len(past_contribs) > 0:
            # Basic stats
            features['total_contributions'] = len(past_contribs)
            features['total_saved'] = past_contribs['amount'].sum()
            features['avg_contribution'] = past_contribs['amount'].mean()
            features['std_contribution'] = past_contribs['amount'].std() if len(past_contribs) > 1 else 0
            
            # Last contribution
            last_contrib_date = past_contribs['transactionDate'].max()
            features['days_since_last_contrib'] = (as_of_date - last_contrib_date).days
            
            # Recency features
            last_3m = as_of_date - timedelta(days=90)
            last_6m = as_of_date - timedelta(days=180)
            last_12m = as_of_date - timedelta(days=365)
            
            recent_3m = past_contribs[past_contribs['transactionDate'] >= last_3m]
            recent_6m = past_contribs[past_contribs['transactionDate'] >= last_6m]
            recent_12m = past_contribs[past_contribs['transactionDate'] >= last_12m]
            
            features['contrib_count_3m'] = len(recent_3m)
            features['contrib_count_6m'] = len(recent_6m)
            features['contrib_count_12m'] = len(recent_12m)
            
            features['contrib_amount_3m'] = recent_3m['amount'].sum()
            features['contrib_amount_6m'] = recent_6m['amount'].sum()
            features['contrib_amount_12m'] = recent_12m['amount'].sum()
            
            # Contribution consistency
            contrib_months = past_contribs['transactionDate'].dt.to_period('M').nunique()
            features['months_active'] = contrib_months
            features['consistency_score'] = contrib_months / max(1, features['membership_months'])
            
            # Completion rate (for non-pending contributions)
            completed = past_contribs[past_contribs['status'] == 'Completed']
            features['completion_rate'] = len(completed) / len(past_contribs) if len(past_contribs) > 0 else 0.5
            
            # Payment method preference
            total_payments = len(past_contribs)
            features['mpesa_pct'] = (past_contribs['paymentMethod'] == 'M-Pesa').sum() / total_payments if total_payments > 0 else 0
            features['cash_pct'] = (past_contribs['paymentMethod'] == 'Cash').sum() / total_payments if total_payments > 0 else 0
            features['bank_pct'] = (past_contribs['paymentMethod'] == 'Bank Transfer').sum() / total_payments if total_payments > 0 else 0
            
        else:
            # Default values for members with no contributions
            features['total_contributions'] = 0
            features['total_saved'] = 0
            features['avg_contribution'] = 0
            features['std_contribution'] = 0
            features['days_since_last_contrib'] = features['membership_days']
            features['contrib_count_3m'] = 0
            features['contrib_count_6m'] = 0
            features['contrib_count_12m'] = 0
            features['contrib_amount_3m'] = 0
            features['contrib_amount_6m'] = 0
            features['contrib_amount_12m'] = 0
            features['months_active'] = 0
            features['consistency_score'] = 0
            features['completion_rate'] = 0.5
            features['mpesa_pct'] = 0
            features['cash_pct'] = 0
            features['bank_pct'] = 0
        
        # ========== NEW: PENDING & OVERDUE CONTRIBUTION FEATURES ==========
        
        # Get pending contributions (status = 'Pending')
        pending_contribs = past_contribs[past_contribs['status'] == 'Pending']
        features['has_pending_contributions'] = len(pending_contribs) > 0
        features['pending_contributions_count'] = len(pending_contribs)
        features['pending_amount_total'] = pending_contribs['amount'].sum()
        features['pending_amount_avg'] = pending_contribs['amount'].mean() if len(pending_contribs) > 0 else 0
        
        # Overdue contributions (due date < today AND still pending)
        if 'dueDate' in past_contribs.columns:
            today = as_of_date
            overdue_contribs = pending_contribs[pending_contribs['dueDate'] < today]
            features['overdue_contributions_count'] = len(overdue_contribs)
            features['overdue_amount_total'] = overdue_contribs['amount'].sum()
            features['has_overdue_contributions'] = len(overdue_contribs) > 0
            
            # Days overdue for the most overdue contribution
            if len(overdue_contribs) > 0:
                max_overdue_days = (today - overdue_contribs['dueDate'].min()).days
                features['max_days_overdue'] = max_overdue_days
            else:
                features['max_days_overdue'] = 0
        else:
            features['overdue_contributions_count'] = 0
            features['overdue_amount_total'] = 0
            features['has_overdue_contributions'] = False
            features['max_days_overdue'] = 0
        
        # Penalties applied
        if 'penaltyApplied' in past_contribs.columns:
            features['total_penalties_paid'] = past_contribs['penaltyApplied'].sum()
            features['has_penalties'] = features['total_penalties_paid'] > 0
            features['avg_penalty'] = past_contribs[past_contribs['penaltyApplied'] > 0]['penaltyApplied'].mean() if features['has_penalties'] else 0
        else:
            features['total_penalties_paid'] = 0
            features['has_penalties'] = False
            features['avg_penalty'] = 0
        
        # ========== NEW: PAYMENT CONSISTENCY (based on schedule) ==========
        
        # Calculate how many weeks/months of contributions were missed
        if len(past_contribs) > 0 and group_settings is not None and len(group_settings) > 0:
            frequency = group_settings.iloc[0].get('contribution_frequency', 'MONTHLY')
            expected_amount = group_settings.iloc[0].get('expected_contribution_amount', 0)
            
            if frequency == 'WEEKLY':
                expected_period_days = 7
                expected_contributions_per_year = 52
            else:  # MONTHLY
                expected_period_days = 30.44
                expected_contributions_per_year = 12
            
            # Calculate expected contributions based on membership duration
            membership_weeks = features['membership_days'] / 7
            expected_contributions = max(1, int(membership_weeks)) if frequency == 'WEEKLY' else max(1, int(features['membership_months']))
            
            # Calculate missed contributions
            features['expected_contributions'] = expected_contributions
            features['missed_contributions'] = max(0, expected_contributions - features['total_contributions'])
            features['missed_contributions_rate'] = features['missed_contributions'] / max(1, expected_contributions)
            
            # Calculate if currently behind schedule
            features['is_behind_schedule'] = features['missed_contributions'] > (expected_contributions * 0.2)
            
        else:
            features['expected_contributions'] = 0
            features['missed_contributions'] = 0
            features['missed_contributions_rate'] = 0
            features['is_behind_schedule'] = False
        
        # ========== 3. LOAN FEATURES (EXISTING) ==========
        past_loans = loans[loans['startDate'] <= as_of_date]
        
        if len(past_loans) > 0:
            features['total_loans'] = len(past_loans)
            features['total_borrowed'] = past_loans['amount'].sum()
            features['avg_loan_amount'] = past_loans['amount'].mean()
            features['max_loan_amount'] = past_loans['amount'].max()
            
            # Loan status counts
            features['active_loans'] = (past_loans['status'] == 'Active').sum()
            features['overdue_loans'] = (past_loans['status'] == 'Overdue').sum()
            features['defaulted_loans'] = (past_loans['status'] == 'Defaulted').sum()
            features['repaid_loans'] = (past_loans['status'] == 'Repaid').sum()
            
            # Financial health
            features['total_outstanding'] = past_loans['outstandingBalance'].sum()
            features['avg_interest_rate'] = past_loans['interestRate'].mean()
            
            # Repayment behavior
            features['repayment_rate'] = (past_loans['status'] == 'Repaid').mean()
            features['default_rate'] = (past_loans['status'] == 'Defaulted').mean()
            
            # Loan recency
            last_loan_date = past_loans['startDate'].max()
            features['days_since_last_loan'] = (as_of_date - last_loan_date).days
            
            # Loan burden
            features['loan_to_savings_ratio'] = features['total_outstanding'] / max(1, features['total_saved'])
            features['has_outstanding_debt'] = 1 if features['total_outstanding'] > 0 else 0
            
        else:
            features['total_loans'] = 0
            features['total_borrowed'] = 0
            features['avg_loan_amount'] = 0
            features['max_loan_amount'] = 0
            features['active_loans'] = 0
            features['overdue_loans'] = 0
            features['defaulted_loans'] = 0
            features['repaid_loans'] = 0
            features['total_outstanding'] = 0
            features['avg_interest_rate'] = 0
            features['repayment_rate'] = 0.5
            features['default_rate'] = 0
            features['days_since_last_loan'] = features['membership_days']
            features['loan_to_savings_ratio'] = 0
            features['has_outstanding_debt'] = 0
        
        # ========== 4. ENGAGEMENT FEATURES (EXISTING) ==========
        past_notifs = notifs[notifs['sendDate'] <= as_of_date]
        
        if len(past_notifs) > 0:
            features['total_notifications'] = len(past_notifs)
            features['loan_applications'] = (past_notifs['type'] == 'Loan Application').sum()
            features['feedback_count'] = (past_notifs['type'] == 'Member Feedback').sum()
            
            # Communication recency
            last_notif_date = past_notifs['sendDate'].max()
            features['days_since_last_communication'] = (as_of_date - last_notif_date).days
            
            # Channel preference
            total_msgs = len(past_notifs)
            features['sms_pct'] = (past_notifs['channel'] == 'SMS').sum() / total_msgs if total_msgs > 0 else 0
            features['app_pct'] = (past_notifs['channel'] == 'Mobile App').sum() / total_msgs if total_msgs > 0 else 0
            features['email_pct'] = (past_notifs['channel'] == 'Email').sum() / total_msgs if total_msgs > 0 else 0
            features['whatsapp_pct'] = (past_notifs['channel'] == 'WhatsApp').sum() / total_msgs if total_msgs > 0 else 0
            
        else:
            features['total_notifications'] = 0
            features['loan_applications'] = 0
            features['feedback_count'] = 0
            features['days_since_last_communication'] = features['membership_days']
            features['sms_pct'] = 0
            features['app_pct'] = 0
            features['email_pct'] = 0
            features['whatsapp_pct'] = 0
        
        # ========== 5. TREND FEATURES ==========
        
        # Contribution trend
        if features['contrib_count_6m'] > 0 and features['months_active'] > 3:
            historical_avg = features['total_contributions'] / max(1, features['months_active'])
            recent_avg = features['contrib_count_6m'] / 6
            features['activity_trend'] = recent_avg / max(0.1, historical_avg)
        else:
            features['activity_trend'] = 1.0
        
        # Savings growth rate
        if features['contrib_amount_12m'] > 0:
            features['savings_growth_rate'] = features['contrib_amount_6m'] / max(1, features['contrib_amount_12m'])
        else:
            features['savings_growth_rate'] = 0.5
        
        # ========== 6. RISK INDICATORS ==========
        features['is_active_status'] = 1 if member['status'] == 'Active' else 0
        features['is_inactive_status'] = 1 if member['status'] == 'Inactive' else 0
        features['is_terminated'] = 1 if member['status'] == 'Terminated' else 0
        
        # Silent period (no activity)
        features['silent_days'] = min(
            features['days_since_last_contrib'],
            features['days_since_last_communication']
        )
        
        # Warning flags
        features['warning_no_contrib_3m'] = 1 if features['contrib_count_3m'] == 0 else 0
        features['warning_no_contrib_6m'] = 1 if features['contrib_count_6m'] == 0 else 0
        features['warning_no_comm_3m'] = 1 if features['days_since_last_communication'] > 90 else 0
        features['warning_high_debt'] = 1 if features['loan_to_savings_ratio'] > 2 else 0
        features['warning_default_history'] = 1 if features['defaulted_loans'] > 0 else 0
        
        # ========== NEW: OVERDUE WARNING FLAGS ==========
        features['warning_has_pending'] = 1 if features['has_pending_contributions'] else 0
        features['warning_has_overdue'] = 1 if features['has_overdue_contributions'] else 0
        features['warning_has_penalties'] = 1 if features['has_penalties'] else 0
        features['warning_behind_schedule'] = 1 if features.get('is_behind_schedule', False) else 0
        
        return features
    
    def get_feature_names(self):
        """Return list of feature names (excluding member_id)"""
        return self.feature_names if self.feature_names else []