# MindScan AI

MindScan AI is a research-focused dementia screening web application that combines a front-end assessment workflow, Node.js backend logic, and a Python-based machine learning pipeline. The system is designed for demonstration and academic learning rather than real clinical diagnosis.

The project simulates a cognitive screening process where a user completes memory, attention, orientation, language, and voice tasks. The app then converts the collected assessment data into a clinical-style risk summary using ML and agent-based reasoning.

---

## 1. Project Overview

This project has three major layers:

1. Frontend: React + Vite app for user assessment and UI
2. Backend: Express server for auth, screening workflow, result processing, and AI/ML APIs
3. ML Layer: Python scripts using scikit-learn for tabular risk prediction and audio feature extraction

The app is structured as a prototype of how an AI-assisted screening pipeline could work in a digital health context.

---

## 2. High-Level System Architecture

### 2.1 Frontend Architecture
The frontend is built using React. It performs these important tasks:

- User login and session management
- Multi-step dementia screening workflow
- Memory recall, attention challenge, orientation questions, language tasks
- Microphone-based voice recording
- API calls to backend endpoints for AI analysis and risk prediction
- Visualization of final summary and referral guidance

Key frontend actions:
- User enters demo credentials
- The app creates a screening session
- The screening result is converted to a tabular feature record with fields such as `Age`, `MMSE`, `CDR`, `SES`, `eTIV`, `nWBV`, and `ASF`
- This record is sent to the backend ML route `/api/ml/predict`
- A separate voice assessment is uploaded to the audio pipeline endpoint
- Final output is presented as risk score, summary, and recommendation

### 2.2 Backend Architecture
The backend is a lightweight Express server that exposes modular routes:

- `/api/auth` → login and user authentication
- `/api/screening` → manage screening workflow and save assessment results
- `/api/ai` → AI summarization logic and reasoning
- `/api/ml` → risk prediction using the trained classifier
- `/api/audio` → voice upload and audio analysis
- `/api/results` → final result reporting

Backend responsibilities:
- Validate user requests
- Manage demo-user authentication
- Store screening data in an in-memory database structure
- Convert assessment scores into ML-ready records
- Trigger Python scripts for prediction using `child_process` / `execFileSync`
- Return JSON to the frontend

### 2.3 Python ML Layer
The Python layer contains:

- `Backend/ml/tabular_baseline.py` → trains and saves the dementia-risk classifier
- `Backend/ml/predict.py` → loads the trained model and predicts risk for a new record
- `Backend/ml/audio_pipeline.py` → extracts audio features from `.wav` files
- `Backend/ml/audio_unsupervised_baseline.py` → clusters audio patterns using KMeans
- `Backend/ml/data_audit.py` → checks dataset quality and clinical assumptions

This separation keeps the research pipeline modular and easy to debug.

---

## 3. End-to-End Data Flow

The complete workflow is:

1. User logs in using demo credentials
2. User answers cognitive tasks
3. The app computes section scores such as memory, attention, language, and orientation
4. A structured feature record is built for the tabular model
5. This record is sent to the backend ML prediction endpoint
6. The backend calls the Python prediction script
7. The classifier produces a probability and class label
8. The AI service combines ML output with domain heuristics into a summary
9. The app displays risk band, recommendation, and referral message

This is a typical pipeline design used in applied machine learning systems:

Input Data → Preprocessing → Model Prediction → Post-processing → Clinical Report

---

## 4. Model Architecture and Algorithm Choice

### 4.1 Primary Predictive Model: Logistic Regression
The main tabular model used in this project is a `LogisticRegression` classifier from scikit-learn.

The model is trained inside `Backend/ml/tabular_baseline.py` using a pipeline:

- `SimpleImputer` for missing values
- `StandardScaler` for numeric features
- `OneHotEncoder` for categorical features
- `LogisticRegression` as the classifier

This is a standard supervised classification pipeline.

### Why Logistic Regression was chosen

This project is a research prototype and not a production clinical system, so the algorithm needs to be:

- simple to explain
- easy to interpret by examiners
- fast to train and validate
- robust on tabular medical-style features
- transparent in classification decisions

Logistic regression is ideal because it offers:

- interpretable coefficients
- straightforward probabilistic output
- good performance on structured clinical datasets when features are meaningful
- fast inference with low computational cost

In viva, a strong answer is:

> We selected logistic regression because the dataset is tabular, the feature space is relatively compact, and the goal is explainability rather than deep complex modeling. For a student project and research prototype, logistic regression is more interpretable and easier to defend than a black-box model.

### 4.2 Data Preprocessing Pipeline
The model uses a `ColumnTransformer` to handle mixed feature types.

Numeric features are transformed by:
- median imputation
- standard scaling

Categorical features are transformed by:
- most-frequent imputation
- one-hot encoding

This is important because:
- machine learning models cannot directly consume missing values
- many clinical variables are mixed-type
- normalizing numeric values improves optimization stability
- one-hot encoding converts text categories into numerical form without losing meaning

### 4.3 Training Strategy
The project uses `GroupShuffleSplit` rather than a simple random split.

Why?
- The dataset contains repeated observations by `Subject ID`
- Random splitting can leak information from the same subject into both train and test sets
- Group-wise splitting ensures subject-level separation between training and testing data

This is an important methodological choice because it reduces leakage and makes the evaluation more realistic.

### 4.4 Class Balancing
The classifier is configured with:

- `class_weight="balanced"`

This matters because the dataset may not be perfectly balanced across classes. In dementia screening data, positive cases often appear in a smaller proportion. The balanced weighting helps prevent the model from favoring the majority class.

---

## 5. Internal Working of the Tabular Model

The actual training logic is implemented in `Backend/ml/tabular_baseline.py`.

### Step-by-step flow

1. Load dataset from `Backend/data/dementia_dataset.csv`
2. Map target classes:
   - `Nondemented -> 0`
   - `Demented -> 1`
   - `Converted -> 1`
3. Remove non-feature columns such as `Subject ID`, `MRI ID`, and `Group`
4. Separate numeric and categorical columns
5. Create preprocessing pipeline
6. Split data by subject using `GroupShuffleSplit`
7. Train the final pipeline on the training subset
8. Evaluate on the test subset using accuracy, F1, precision, recall, ROC-AUC, confusion matrix
9. Save the trained model and metadata into `artifacts/models/tabular/baseline_v1`

### Output of the model
The saved component includes:
- trained logistic regression model
- preprocessor object
- metadata JSON describing model type, training counts, feature list, and evaluation metrics

This means the model can be reused at inference time without retraining.

---

## 6. Prediction Flow in the App

The runtime prediction process is handled by `Backend/ml/predict.py`.

The prediction script:
- loads the saved model artifacts
- reads a new patient record
- applies the same preprocessing used during training
- computes class probability using `predict_proba()`
- returns a binary prediction and confidence value

The backend route `POST /api/ml/predict` forwards the structured record from the frontend to this inference layer.

This separation ensures the model is not retrained live for every prediction; the application uses a pre-trained artifact for reproducibility and speed.

---

## 7. Why the Model Uses This Feature Set

The tabular record includes variables such as:

- `Age`
- `EDUC` (education)
- `SES` (socioeconomic status)
- `MMSE`
- `CDR`
- `eTIV`
- `nWBV`
- `ASF`
- `M/F`
- `Hand`
- `Visit`

These features are clinically meaningful because they are often associated with cognitive health and neurodegeneration.

For example:
- lower MMSE often correlates with stronger cognitive impairment
- higher CDR indicates more severe decline
- age and education are known confounding and contextual factors
- brain volume and structure measures like `nWBV` are used in neuroimaging-inspired cohorts

This is why the project uses a clinical-style risk score rather than a random heuristic.

---

## 8. Audio Architecture

The audio branch is intentionally kept separate from the tabular model.

### Why it is separate
The project explicitly states that:
- the audio dataset is not linked to the tabular dataset by verified subject identity
- there is no reliable patient-level mapping between the two modalities
- multimodal fusion would be methodologically unsafe without a shared subject key

This is a very important point in a viva interview, because it demonstrates awareness of data integrity and methodological caution.

### 8.1 Audio Feature Extraction
`Backend/ml/audio_pipeline.py` processes all `.wav` files in `Backend/data/dementia`.

It uses the `librosa` library to compute:
- duration
- RMS energy
- zero crossing rate
- spectral centroid
- spectral bandwidth
- spectral rolloff
- MFCC features

These features summarize voice and speech characteristics such as timbre, rhythm, and spectral profile.

The script creates:
- `audio_features.csv`
- `audio_subject_features.csv`
- `audio_metadata.json`

### 8.2 Subject-Level Aggregation
The pipeline aggregates per-subject audio statistics using averages, standard deviations, minima, and maxima.

This helps convert raw wav recordings into a cleaner subject-level representation for exploratory analysis.

### 8.3 Audio Baseline Model: KMeans Clustering
`Backend/ml/audio_unsupervised_baseline.py` uses unsupervised clustering.

Algorithm:
- StandardScaler normalizes features
- KMeans clusters the audio feature vectors
- Silhouette score evaluates cluster quality when possible

This is not a dementia classifier because there are no labels for each audio sample or subject. It is used as a clustering baseline to discover voice patterns rather than predict diagnosis.

### Why KMeans was selected here
KMeans is appropriate because:
- there are no labels
- audio feature vectors are numeric and high-dimensional
- unsupervised grouping helps reveal hidden structure in the data
- it is easy to implement and explain in a research prototype

A viva-ready answer:

> For audio, we cannot use a supervised dementia classifier because the dataset lacks verified subject-level class labels. So we instead used KMeans to identify natural clusters of acoustic patterns, which is an exploratory unsupervised baseline.

---

## 9. AI Agent Ensemble Layer

The final risk report is not purely model output. It also includes a multi-agent reasoning layer implemented in `Backend/services/aiService.js`.

The function `runMultiAgentAnalysis` creates multiple domain-specific “agents”:

- Memory Agent
- Attention Agent
- Language Agent
- Orientation Agent
- Voice Agent
- Clinical Context Agent

Each agent assigns a score and a label such as:
- healthy
- watchful
- declining
- stable
- variable
- degraded
- high-risk context

The ensemble then combines these domain scores into an overall result using weighted contributions.

### Why this design is useful
The ensemble provides:
- a more human-readable output
- domain-specific evidence
- explainability for a screening dashboard
- a way to combine model risk with task-based assessment scores

This is valuable in a demo application because it creates the impression of a clinical reasoning process without pretending to replace medical diagnosis.

---

## 10. Why This Architecture Works Well for a Demo Project

This project is designed to demonstrate several important concepts:

- full-stack product workflow
- ML pipeline integration
- data preprocessing and model inference
- explainability and interpretability
- multimodal prototype thinking
- research caution around dataset limitations

It combines:
- tabular risk prediction for structured clinical features
- audio feature extraction for speech analysis
- AI-style agent reasoning for domain interpretation
- front-end workflow for real user interaction

It is not a clinical-grade system, but it successfully demonstrates how a modern digital screening application could be structured.

---

## 11. Important Limitations and Ethical Notes

This is a critical section for viva questions.

The project clearly notes several limitations:

- It is a research prototype and educational demonstration.
- It should not be treated as a medical diagnosis tool.
- Audio and tabular datasets are not formally linked by the same subject identifiers.
- The model is trained on a cohort-style dataset and not on real-world clinical deployment data.
- There are no verified clinical labels for some audio segments.
- The app uses heuristic scoring and agent interpretation rather than a validated clinical decision system.

This is ethically important because it shows you understand that AI in healthcare must be transparent, limited, and non-diagnostic unless properly validated.

---

## 12. Basic Viva Questions and Strong Answers

### Q1: What is the core algorithm of the project?
Answer: The main supervised model is a logistic regression classifier trained on structured tabular data. It uses preprocessing for missing values and mixed feature types before classification.

### Q2: Why did you choose logistic regression instead of deep learning?
Answer: Because the dataset is tabular, the prediction task is relatively small-scale, and interpretability matters more than raw complexity. Logistic regression is easier to explain, faster to train, and suitable for a research prototype.

### Q3: Why use GroupShuffleSplit instead of ordinary train-test split?
Answer: To avoid subject leakage. If the same patient appears in both train and test data, the model may appear artificially strong. Group-based splitting ensures subject independence.

### Q4: Why is one-hot encoding and scaling required?
Answer: Because the dataset has both numeric and categorical variables, and models need numerical inputs. Scaling improves optimization, while one-hot encoding turns categories into usable feature vectors.

### Q5: Why is audio kept separate from the tabular model?
Answer: Because there is no verified subject-level linkage between the tabular and audio datasets. Combining them without a common identifier would be scientifically invalid.

### Q6: What is the role of KMeans in the audio analysis?
Answer: It acts as an exploratory unsupervised clustering baseline to discover acoustic patterns. It is not used as a dementia diagnosis model because no labels are available.

### Q7: Why is the model called a prototype?
Answer: Because it is designed for academic demonstration, not clinical deployment. It does not replace professional medical evaluation.

### Q8: What is the importance of class weights?
Answer: They help the model handle imbalanced class distributions, ensuring the classifier does not ignore the minority positive class.

### Q9: Why is explainability important in this project?
Answer: In healthcare, users and clinicians need to understand why a model produced a result. A transparent model builds trust and makes the project easier to assess academically.

### Q10: What is the main advantage of the agent-based reasoning layer?
Answer: It converts raw scores into understandable clinical-style explanations and risk bands, improving the user experience and making the output easier to interpret.

---

## 13. Final Summary

MindScan AI is a multi-layer dementia screening prototype that combines:

- a React-based user assessment workflow
- an Express API backend
- a supervised tabular risk model based on logistic regression
- audio feature extraction using `librosa`
- unsupervised clustering as an exploratory audio baseline
- an explainable AI summary layer for clinical-style reporting

The core research idea is to simulate a digital screening system while staying honest about its limitations. The system is educational, interpretable, and structured in a way that makes it suitable for academic explanation and viva presentation.

---

## 14. Run the App

### 1) Start the backend
```powershell
cd "C:/Users/SONU/OneDrive/Desktop/Dimentia Detection/Backend"
node server.js
```

### 2) Start the frontend
```powershell
cd "C:/Users/SONU/OneDrive/Desktop/Dimentia Detection/Frontend"
npm run dev
```

### 3) Open the app
Visit the local Vite URL shown in the terminal, usually:

- http://localhost:5173

### Demo credentials
- Email: sunny@gmail.com
- Password: 123456

---

## 15. What the app demonstrates

- Cognitive screening workflow with memory, attention, language, and orientation tasks
- Voice assessment step with microphone capture
- Audio analysis agent using extracted acoustic features
- ML risk-score view based on the trained tabular baseline
- Final summary with AI explanation and referral guidance

This makes the application a strong example of an academic prototype combining frontend UX, backend APIs, and ML engineering.
