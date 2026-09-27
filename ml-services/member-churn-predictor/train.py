# member-churn-predictor/train.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
import joblib
import warnings
import os
from datetime import datetime, timedelta
warnings.filterwarnings('ignore')

# Use the new churn_features instead of features
from churn_features import ChurnFeatureEngineer

class MemberChurnTrainer:
    def __init__(self):
        self.feature_engineer = ChurnFeatureEngineer()  # Changed to new class
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = None
        
    def load_data(self):
        """Load your CSV data from the data folder"""
        print("📂 Loading data...")
        
        data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        
        members = pd.read_csv(os.path.join(data_path, 'members_ml_training.csv'))
        contributions = pd.read_csv(os.path.join(data_path, 'contributions_ml_training.csv'))
        loans = pd.read_csv(os.path.join(data_path, 'loans_ml_training.csv'))
        notifications = pd.read_csv(os.path.join(data_path, 'member_comments_ml_training.csv'))
        
        print(f"   Members: {len(members):,}")
        print(f"   Contributions: {len(contributions):,}")
        print(f"   Loans: {len(loans):,}")
        print(f"   Notifications: {len(notifications):,}")
        
        return members, contributions, loans, notifications
    
    def create_labels(self, members, contributions, as_of_date, lookahead_months=6):
        """Create churn labels"""
        future_date = as_of_date + timedelta(days=30*lookahead_months)
        
        labels = []
        
        for _, member in members.iterrows():
            member_id = member['id']
            
            future_contribs = contributions[
                (contributions['member_id'] == member_id) &
                (pd.to_datetime(contributions['transactionDate']) > as_of_date) &
                (pd.to_datetime(contributions['transactionDate']) <= future_date)
            ]
            
            if member['status'] == 'Terminated':
                churned = 1
            elif member['status'] == 'Inactive' and len(future_contribs) == 0:
                churned = 1
            elif len(future_contribs) == 0 and member['status'] == 'Active':
                churned = 1
            else:
                churned = 0
            
            labels.append({
                'member_id': member_id,
                'churned': churned,
                'current_status': member['status']
            })
        
        return pd.DataFrame(labels)
    
    def prepare_training_data(self):
        """Prepare features and labels for training"""
        
        members, contributions, loans, notifications = self.load_data()
        
        members['joinDate'] = pd.to_datetime(members['joinDate'])
        contributions['transactionDate'] = pd.to_datetime(contributions['transactionDate'])
        loans['startDate'] = pd.to_datetime(loans['startDate'])
        notifications['sendDate'] = pd.to_datetime(notifications['sendDate'])
        
        snapshots = []
        
        start_date = datetime(2021, 1, 1)
        end_date = datetime(2023, 6, 30)
        
        current_date = start_date
        while current_date <= end_date:
            print(f"\n📸 Processing snapshot: {current_date.date()}")
            
            features_df = self.feature_engineer.create_features(
                members, contributions, loans, notifications, current_date
            )
            
            labels_df = self.create_labels(members, contributions, current_date, 6)
            
            snapshot_data = features_df.merge(labels_df[['member_id', 'churned']], on='member_id')
            snapshot_data['snapshot_date'] = current_date
            
            snapshots.append(snapshot_data)
            
            current_date += timedelta(days=90)
        
        full_data = pd.concat(snapshots, ignore_index=True)
        
        print(f"\n📊 Total samples: {len(full_data):,}")
        churned_count = full_data['churned'].sum()
        print(f"   Churned samples: {churned_count:,} ({full_data['churned'].mean()*100:.1f}%)")
        
        feature_cols = [col for col in full_data.columns 
                       if col not in ['member_id', 'churned', 'snapshot_date']]
        
        self.feature_names = feature_cols
        
        X = full_data[feature_cols]
        y = full_data['churned']
        
        X = X.fillna(0)
        
        return X, y, full_data
    
    def train(self):
        """Train churn prediction model"""
        
        print("=" * 60)
        print("🚀 TRAINING MEMBER CHURN PREDICTION MODEL")
        print("=" * 60)
        
        X, y, full_data = self.prepare_training_data()
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        print(f"\n📊 Training samples: {len(X_train):,}")
        print(f"   Testing samples: {len(X_test):,}")
        print(f"   Train churn rate: {y_train.mean()*100:.1f}%")
        print(f"   Test churn rate: {y_test.mean()*100:.1f}%")
        
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        models = {
            'XGBoost': XGBClassifier(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                use_label_encoder=False,
                eval_metric='logloss'
            ),
            'RandomForest': RandomForestClassifier(
                n_estimators=200,
                max_depth=10,
                min_samples_split=20,
                min_samples_leaf=10,
                random_state=42,
                n_jobs=-1
            ),
            'LogisticRegression': LogisticRegression(
                C=1.0,
                max_iter=1000,
                class_weight='balanced',
                random_state=42,
                n_jobs=-1
            )
        }
        
        best_model = None
        best_score = 0
        best_model_name = ""
        
        for name, model in models.items():
            print(f"\n🤖 Training {name}...")
            model.fit(X_train_scaled, y_train)
            
            train_score = model.score(X_train_scaled, y_train)
            test_score = model.score(X_test_scaled, y_test)
            
            y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
            roc_auc = roc_auc_score(y_test, y_pred_proba)
            
            print(f"   Train accuracy: {train_score:.3f}")
            print(f"   Test accuracy: {test_score:.3f}")
            print(f"   ROC-AUC: {roc_auc:.3f}")
            
            if test_score > best_score:
                best_score = test_score
                best_model = model
                best_model_name = name
                print(f"   ✅ New best model: {name}!")
        
        self.model = best_model
        
        print("\n" + "=" * 60)
        print(f"📊 FINAL MODEL EVALUATION ({best_model_name})")
        print("=" * 60)
        
        X_test_scaled = self.scaler.transform(X_test)
        y_pred = self.model.predict(X_test_scaled)
        y_pred_proba = self.model.predict_proba(X_test_scaled)[:, 1]
        
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Active', 'Churned']))
        
        print(f"\nROC-AUC Score: {roc_auc_score(y_test, y_pred_proba):.3f}")
        
        if hasattr(self.model, 'feature_importances_'):
            print("\n🔍 Top 15 Important Features:")
            importances = self.model.feature_importances_
            indices = np.argsort(importances)[::-1][:15]
            
            for i, idx in enumerate(indices):
                print(f"   {i+1}. {self.feature_names[idx]}: {importances[idx]:.3f}")
        
        self.save_model()
        
        return self.model
    
    def save_model(self):
        """Save model and scaler"""
        os.makedirs('models', exist_ok=True)
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'model_type': type(self.model).__name__,
            'training_date': datetime.now().isoformat()
        }
        
        path = 'models/member_churn_predictor.joblib'
        joblib.dump(model_data, path)
        print(f"\n💾 Model saved to {path}")

if __name__ == "__main__":
    trainer = MemberChurnTrainer()
    model = trainer.train()