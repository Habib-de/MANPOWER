# member-churn-predictor/churn_features.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

class ChurnFeatureEngineer:
    """
    Feature engineer specifically for member churn prediction
    Works with existing contribution data (no new columns needed)
    """
    def __init__(self):
        self.feature_names = None
        
    def create_features(self, members_df, contributions_df, loans_df, notifications_df, 
                       as_of_date=None):
        """
        Create features for member churn prediction
        Uses existing data structure - no new columns required
        """
        if as_of_date is None:
            as_of_date = datetime.now()
        
        print(f"📅 Creating features as of {as_of_date.date()}")
        
        # Convert dates
        members_df['joinDate'] = pd.to_datetime(members_df['joinDate'])
        contributions_df['transactionDate'] = pd.to_datetime(contributions_df['transactionDate'])
        loans_df['startDate'] = pd.to_datetime(loans_df['startDate'])
        notifications_df['sendDate'] = pd.to_datetime(notifications_df['sendDate'])
        
        features_list = []
        
        for _, member in members_df.iterrows():
            member_id = member['id']
            
            # Filter data for this member
            member_contribs = contributions_df[contributions_df['member_id'] == member_id]
            member_loans = loans_df[loans_df['member_id'] == member_id]
            member_notifs = notifications_df[notifications_df['member_id'] == member_id]
            
            features = self._calculate_member_features(
                member, member_contribs, member_loans, member_notifs, as_of_date
            )
            features_list.append(features)
        
        features_df = pd.DataFrame(features_list)
        self.feature_names = [f for f in features_df.columns if f != 'member_id']
        
        return features_df
    
    def _calculate_member_features(self, member, contribs, loans, notifs, as_of_date):
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
        
        # ========== 2. CONTRIBUTION FEATURES ==========
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
            
            # Payment method preference
            total_payments = len(past_contribs)
            features['mpesa_pct'] = (past_contribs['paymentMethod'] == 'M-Pesa').sum() / total_payments if total_payments > 0 else 0
            features['cash_pct'] = (past_contribs['paymentMethod'] == 'Cash').sum() / total_payments if total_payments > 0 else 0
            features['bank_pct'] = (past_contribs['paymentMethod'] == 'Bank Transfer').sum() / total_payments if total_payments > 0 else 0
            
            # ========== NEW: Calculate payment patterns from existing data ==========
            # Calculate payment regularity (standard deviation of days between payments)
            if len(past_contribs) > 1:
                payment_dates = past_contribs['transactionDate'].sort_values()
                days_between = payment_dates.diff().dt.days.dropna()
                features['payment_regularity'] = 1 / (1 + days_between.std()) if days_between.std() > 0 else 1
            else:
                features['payment_regularity'] = 0.5
            
            # Calculate average days between payments
            if len(past_contribs) > 1:
                avg_days_between = days_between.mean()
                features['avg_days_between_payments'] = avg_days_between
                # Flag if member is likely monthly (avg ~30 days) or weekly (avg ~7 days)
                features['is_likely_monthly'] = 1 if 25 <= avg_days_between <= 35 else 0
                features['is_likely_weekly'] = 1 if 5 <= avg_days_between <= 10 else 0
            else:
                features['avg_days_between_payments'] = features['membership_days']
                features['is_likely_monthly'] = 0
                features['is_likely_weekly'] = 0
            
            # Payment amount consistency (low variance = consistent)
            if len(past_contribs) > 1:
                amount_std = past_contribs['amount'].std()
                amount_mean = past_contribs['amount'].mean()
                features['payment_amount_consistency'] = 1 / (1 + (amount_std / max(1, amount_mean)))
            else:
                features['payment_amount_consistency'] = 0.5
            
        else:
            # Default values
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
            features['mpesa_pct'] = 0
            features['cash_pct'] = 0
            features['bank_pct'] = 0
            features['payment_regularity'] = 0
            features['avg_days_between_payments'] = 0
            features['is_likely_monthly'] = 0
            features['is_likely_weekly'] = 0
            features['payment_amount_consistency'] = 0
        
        # ========== 3. LOAN FEATURES ==========
        past_loans = loans[loans['startDate'] <= as_of_date]
        
        if len(past_loans) > 0:
            features['total_loans'] = len(past_loans)
            features['total_borrowed'] = past_loans['amount'].sum()
            features['avg_loan_amount'] = past_loans['amount'].mean()
            features['max_loan_amount'] = past_loans['amount'].max()
            
            features['active_loans'] = (past_loans['status'] == 'Active').sum()
            features['overdue_loans'] = (past_loans['status'] == 'Overdue').sum()
            features['defaulted_loans'] = (past_loans['status'] == 'Defaulted').sum()
            features['repaid_loans'] = (past_loans['status'] == 'Repaid').sum()
            
            features['total_outstanding'] = past_loans['outstandingBalance'].sum()
            features['avg_interest_rate'] = past_loans['interestRate'].mean()
            features['repayment_rate'] = (past_loans['status'] == 'Repaid').mean()
            features['default_rate'] = (past_loans['status'] == 'Defaulted').mean()
            
            last_loan_date = past_loans['startDate'].max()
            features['days_since_last_loan'] = (as_of_date - last_loan_date).days
            
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
        
        # ========== 4. ENGAGEMENT FEATURES ==========
        past_notifs = notifs[notifs['sendDate'] <= as_of_date]
        
        if len(past_notifs) > 0:
            features['total_notifications'] = len(past_notifs)
            features['loan_applications'] = (past_notifs['type'] == 'Loan Application').sum()
            features['feedback_count'] = (past_notifs['type'] == 'Member Feedback').sum()
            
            last_notif_date = past_notifs['sendDate'].max()
            features['days_since_last_communication'] = (as_of_date - last_notif_date).days
            
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
        if features['contrib_count_6m'] > 0 and features['months_active'] > 3:
            historical_avg = features['total_contributions'] / max(1, features['months_active'])
            recent_avg = features['contrib_count_6m'] / 6
            features['activity_trend'] = recent_avg / max(0.1, historical_avg)
        else:
            features['activity_trend'] = 1.0
        
        if features['contrib_amount_12m'] > 0:
            features['savings_growth_rate'] = features['contrib_amount_6m'] / max(1, features['contrib_amount_12m'])
        else:
            features['savings_growth_rate'] = 0.5
        
        # ========== 6. RISK INDICATORS ==========
        features['is_active_status'] = 1 if member['status'] == 'Active' else 0
        features['is_inactive_status'] = 1 if member['status'] == 'Inactive' else 0
        features['is_terminated'] = 1 if member['status'] == 'Terminated' else 0
        
        features['silent_days'] = min(
            features['days_since_last_contrib'],
            features['days_since_last_communication']
        )
        
        # Warning flags (based on existing data)
        features['warning_no_contrib_3m'] = 1 if features['contrib_count_3m'] == 0 else 0
        features['warning_no_contrib_6m'] = 1 if features['contrib_count_6m'] == 0 else 0
        features['warning_no_comm_3m'] = 1 if features['days_since_last_communication'] > 90 else 0
        features['warning_high_debt'] = 1 if features['loan_to_savings_ratio'] > 2 else 0
        features['warning_default_history'] = 1 if features['defaulted_loans'] > 0 else 0
        
        # New warning flags from payment patterns
        features['warning_irregular_payments'] = 1 if features['payment_regularity'] < 0.3 else 0
        features['warning_amount_changed'] = 1 if features['payment_amount_consistency'] < 0.3 else 0
        
        return features
    
    def get_feature_names(self):
        """Return list of feature names (excluding member_id)"""
        return self.feature_names if self.feature_names else []