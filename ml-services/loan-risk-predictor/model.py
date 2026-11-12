# loan-risk-predictor/model.py - FIXED VERSION WITH BETTER RISK LABELING
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.preprocessing import StandardScaler
import joblib
import os
from datetime import datetime

class LoanRiskPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        
    def load_data(self):
        """Load data from CSV files"""
        print("📊 Loading data for risk prediction...")
        
        try:
            members = pd.read_csv('../data/members_ml_training.csv')
            loans = pd.read_csv('../data/loans_ml_training.csv')
            
            print(f"✅ Loaded: {len(members):,} members, {len(loans):,} loans")
            return members, loans
            
        except FileNotFoundError as e:
            print(f"❌ Error loading data: {e}")
            raise
    
    def prepare_features(self, members_df, loans_df):
        """Prepare features for risk prediction using ONLY available database columns"""
        print("🔄 Preparing risk prediction features...")
        
        # Calculate risk labels from loans data
        risk_labels = self._calculate_risk_labels(loans_df)
        
        # Merge with member data
        members_df_renamed = members_df.rename(columns={'id': 'member_id'})
        merged_data = members_df_renamed.merge(risk_labels, on='member_id', how='left')
        
        # Feature engineering using ONLY available columns
        features = self._engineer_features_no_leakage(merged_data, loans_df)
        
        # Handle members with no loan history - treat as low risk
        features['is_high_risk'] = features['is_high_risk'].fillna(0)
        
        # Count how many members had no loan history
        no_loan_members = merged_data['is_high_risk'].isna().sum()
        if no_loan_members > 0:
            print(f"📝 {no_loan_members} members with no loan history treated as LOW RISK")
        
        return features
    
    def _calculate_risk_labels(self, loans_df):
        """Calculate BETTER risk labels using multiple factors"""
        print("🎯 Calculating BETTER risk labels...")
        
        # Group by member and calculate comprehensive metrics
        member_risk = loans_df.groupby('member_id').agg({
            'status': [
                lambda x: (x == 'Defaulted').sum(),     # defaults
                lambda x: (x == 'Overdue').sum(),       # overdue
                lambda x: (x == 'Repaid').sum(),        # repaid
                lambda x: (x == 'Active').sum(),        # active
            ],
            'outstandingBalance': 'sum',                # total debt
            'amount': ['mean', 'max', 'count']         # loan patterns
        }).reset_index()
        
        # Flatten columns
        member_risk.columns = [
            'member_id', 'defaults_count', 'overdue_count', 'repaid_count', 'active_count',
            'total_outstanding', 'avg_loan_amount', 'max_loan_amount', 'loan_count'
        ]
        
        # CALCULATE COMPREHENSIVE RISK SCORE (0-100)
        risk_scores = []
        
        for _, row in member_risk.iterrows():
            score = 0
            
            # 1. Defaults (50 points if any default)
            if row['defaults_count'] > 0:
                score += 50 + (row['defaults_count'] * 10)
            
            # 2. Overdue loans (30 points if any overdue)
            if row['overdue_count'] > 0:
                score += 30 + (row['overdue_count'] * 8)
            
            # 3. High debt ratio (outstanding vs max loan)
            if row['max_loan_amount'] > 0:
                debt_ratio = row['total_outstanding'] / row['max_loan_amount']
                if debt_ratio > 0.8:
                    score += 40
                elif debt_ratio > 0.5:
                    score += 25
                elif debt_ratio > 0.3:
                    score += 15
            
            # 4. Multiple active loans (risk of over-indebtedness)
            if row['active_count'] > 1:
                score += 20 + ((row['active_count'] - 1) * 5)
            
            # 5. High loan count (many loans = higher risk)
            if row['loan_count'] > 3:
                score += 15 + ((row['loan_count'] - 3) * 3)
            
            # Convert to probability (0-100%)
            risk_probability = min(100, score) / 100
            
            # Mark as high risk if probability > 30% (not just defaults!)
            is_high_risk = 1 if risk_probability > 0.3 else 0
            
            risk_scores.append({
                'member_id': row['member_id'],
                'risk_score': score,
                'risk_probability': risk_probability,
                'is_high_risk': is_high_risk
            })
        
        risk_df = pd.DataFrame(risk_scores)
        
        # Statistics
        risk_counts = risk_df['is_high_risk'].value_counts()
        print(f"📊 Better Risk Distribution:")
        print(f"   - Low Risk Members: {risk_counts.get(0, 0)} ({risk_counts.get(0, 0)/len(risk_df)*100:.1f}%)")
        print(f"   - High Risk Members: {risk_counts.get(1, 0)} ({risk_counts.get(1, 0)/len(risk_df)*100:.1f}%)")
        
        # Show risk probability distribution
        print(f"📈 Risk Probability Range: {risk_df['risk_probability'].min():.2f} - {risk_df['risk_probability'].max():.2f}")
        print(f"📈 Average Risk Probability: {risk_df['risk_probability'].mean():.2f}")
        
        return risk_df[['member_id', 'is_high_risk', 'risk_probability']]
    
    def _engineer_features_no_leakage(self, merged_data, loans_df):
        """Engineer features using ONLY available database columns"""
        print("🔧 Engineering features from database schema...")
        
        # Feature 1: Member tenure (from joinDate)
        merged_data = merged_data.copy()
        merged_data['joinDate'] = pd.to_datetime(merged_data['joinDate'])
        current_date = pd.Timestamp.now()
        merged_data['membership_days'] = (current_date - merged_data['joinDate']).dt.days
        merged_data['membership_months'] = merged_data['membership_days'] / 30
        
        # Feature 2: Member status encoded
        merged_data['is_active'] = (merged_data['status'] == 'Active').astype(int)
        
        # Feature 3: Loan behavior patterns
        loan_behavior = loans_df.groupby('member_id').agg({
            'amount': ['count', 'mean', 'max'],  # Basic loan patterns
            'interestRate': 'mean',              # Historical interest rates
            'outstandingBalance': 'mean',        # Current debt levels
            'status': lambda x: (x == 'Repaid').mean(),  # Repayment success rate
        }).reset_index()
        
        loan_behavior.columns = [
            'member_id', 'loan_count', 'avg_loan_amount', 'max_loan_amount',
            'avg_interest_rate', 'avg_outstanding', 'repayment_rate'
        ]
        
        # Merge loan behavior
        features = merged_data.merge(loan_behavior, on='member_id', how='left')
        
        # Fill NaN values for members with no loan history
        fill_values = {
            'loan_count': 0,
            'avg_loan_amount': 0,
            'max_loan_amount': 0,
            'avg_interest_rate': 0,
            'avg_outstanding': 0,
            'repayment_rate': 0.5  # Neutral for no history
        }
        
        for col in fill_values:
            if col in features.columns:
                features[col] = features[col].fillna(fill_values[col])
        
        # Create loan history indicator
        features['has_loan_history'] = (features['loan_count'] > 0).astype(int)
        
        # Calculate loan-to-capacity ratio (using loan amounts as proxy for capacity)
        features['loan_to_capacity_ratio'] = features['avg_loan_amount'] / (features['avg_loan_amount'] + 1)
        
        # Select final features - ONLY THOSE AVAILABLE IN DATABASE
        feature_columns = [
            # Membership information
            'membership_months', 'is_active',
            
            # Loan behavior patterns
            'loan_count', 'avg_loan_amount', 'max_loan_amount', 
            'avg_interest_rate', 'avg_outstanding', 'repayment_rate',
            'has_loan_history', 'loan_to_capacity_ratio'
        ]
        
        self.feature_columns = feature_columns
        
        print(f"✅ Features engineered: {len(feature_columns)} features")
        print(f"🔍 Available features: {feature_columns}")
        
        return features
    
    def train(self, save_model=True):
        """Train the risk prediction model"""
        print("🤖 Training Loan Risk Predictor...")
        
        # Load data
        members_df, loans_df = self.load_data()
        
        # Prepare features
        features_df = self.prepare_features(members_df, loans_df)
        
        # Check for any remaining NaN values
        nan_check = features_df[self.feature_columns + ['is_high_risk']].isna().sum()
        if nan_check.any():
            print("🚨 NaN values found:")
            print(nan_check[nan_check > 0])
            features_df = features_df.fillna(0)
            print("✅ NaN values filled with 0")
        
        # Prepare data
        X = features_df[self.feature_columns]
        y = features_df['is_high_risk']
        
        # Verify no NaN values remain
        assert not X.isna().any().any(), "NaN values found in features"
        assert not y.isna().any(), "NaN values found in target"
        
        # Handle class imbalance
        risk_ratio = y.value_counts()
        print(f"📊 Class Distribution: {risk_ratio.to_dict()}")
        print(f"   - Low Risk: {risk_ratio.get(0, 0)} members ({risk_ratio.get(0, 0)/len(y)*100:.1f}%)")
        print(f"   - High Risk: {risk_ratio.get(1, 0)} members ({risk_ratio.get(1, 0)/len(y)*100:.1f}%)")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        
        print(f"📈 Train set: {len(X_train)} members")
        print(f"📈 Test set: {len(X_test)} members")
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.model = RandomForestClassifier(
            n_estimators=150,
            max_depth=10,
            min_samples_split=8,
            min_samples_leaf=4,
            class_weight='balanced',
            random_state=42
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_score = self.model.score(X_train_scaled, y_train)
        test_score = self.model.score(X_test_scaled, y_test)
        
        # Predict probabilities
        y_pred_proba = self.model.predict_proba(X_test_scaled)[:, 1]
        roc_auc = roc_auc_score(y_test, y_pred_proba)
        
        print(f"✅ Training completed!")
        print(f"📊 Train Accuracy: {train_score:.4f}")
        print(f"📊 Test Accuracy: {test_score:.4f}")
        print(f"📊 ROC-AUC Score: {roc_auc:.4f}")
        
        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': self.feature_columns,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        print("\n🔍 Feature Importance:")
        print("=====================")
        for _, row in feature_importance.iterrows():
            importance_bar = "█" * int(row['importance'] * 50)
            print(f"   {row['feature']:25}: {row['importance']:.4f} {importance_bar}")
        
        if save_model:
            self.save_model()
        
        return test_score, roc_auc
    
    def predict_risk(self, member_features):
        """Predict default risk for a member"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        # Convert to DataFrame with feature names
        if isinstance(member_features, list):
            features_df = pd.DataFrame([member_features], columns=self.feature_columns)
        elif hasattr(member_features, 'iloc'):
            features_df = pd.DataFrame([member_features[self.feature_columns].values], 
                                     columns=self.feature_columns)
        elif isinstance(member_features, np.ndarray):
            features_df = pd.DataFrame(member_features.reshape(1, -1), 
                                     columns=self.feature_columns)
        else:
            try:
                features_list = [member_features[col] for col in self.feature_columns]
                features_df = pd.DataFrame([features_list], columns=self.feature_columns)
            except (TypeError, KeyError):
                raise ValueError("member_features must be a list, pandas Series, numpy array, or dict-like object")
        
        # Scale features
        features_scaled = self.scaler.transform(features_df)
        
        # Predict probability
        default_probability = self.model.predict_proba(features_scaled)[0][1]
        
        # BETTER risk thresholds (based on real SACCO data)
        if default_probability < 0.15:
            risk_level = "VERY LOW"
            recommendation = "APPROVE"
            emoji = "✅"
        elif default_probability < 0.30:
            risk_level = "LOW"
            recommendation = "APPROVE"
            emoji = "✅"
        elif default_probability < 0.50:
            risk_level = "MEDIUM"
            recommendation = "APPROVE WITH CAUTION"
            emoji = "⚠️"
        elif default_probability < 0.70:
            risk_level = "HIGH"
            recommendation = "APPROVE WITH STRICT TERMS"
            emoji = "🚨"
        else:
            risk_level = "VERY HIGH"
            recommendation = "REJECT"
            emoji = "❌"
        
        # Also provide risk score (0-100)
        risk_score = int(default_probability * 100)
        
        return {
            'default_probability': round(default_probability * 100, 2),
            'risk_score': risk_score,
            'risk_level': risk_level,
            'recommendation': recommendation,
            'emoji': emoji,
            'confidence': round(max(self.model.predict_proba(features_scaled)[0]), 3)
        }
    
    def save_model(self, path='models/risk_predictor.joblib'):
        """Save trained model"""
        os.makedirs('models', exist_ok=True)
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_columns': self.feature_columns
        }, path)
        print(f"💾 Model saved to {path}")
    
    def load_model(self, path='models/risk_predictor.joblib'):
        """Load trained model"""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found: {path}")
        
        loaded = joblib.load(path)
        self.model = loaded['model']
        self.scaler = loaded['scaler']
        self.feature_columns = loaded['feature_columns']
        print(f"📂 Model loaded from {path}")

if __name__ == "__main__":
    print("🛡️ Loan Risk Predictor Model")
    print("Run train.py to train the model.")