"""MindScan AI preprocessing package for tabular, audio, and clock-drawing data."""

from .audio_preprocessing import (
    extract_acoustic_features,
    extract_acoustic_features_from_wav,
    validate_wav_audio,
)
from .speech_features import (
    analyze_multilingual_transcript,
    extract_speech_intelligence,
    get_language_capabilities,
)

__all__ = [
    "extract_acoustic_features",
    "extract_acoustic_features_from_wav",
    "validate_wav_audio",
    "analyze_multilingual_transcript",
    "extract_speech_intelligence",
    "get_language_capabilities",
]

try:
    from .data_cleaning import (
        analyze_missing_values,
        clean_tabular_dataframe,
        detect_duplicates,
        strip_column_whitespace,
    )
    __all__.extend([
        "analyze_missing_values",
        "clean_tabular_dataframe",
        "detect_duplicates",
        "strip_column_whitespace",
    ])
except ImportError:
    pass

try:
    from .image_preprocessing import (
        extract_clock_drawing_features,
        validate_drawing_image,
    )
    __all__.extend([
        "extract_clock_drawing_features",
        "validate_drawing_image",
    ])
except ImportError:
    pass

try:
    from .feature_engineering import (
        fit_transform_preprocessor,
        participant_level_split,
        validate_feature_schema,
        version_dataset_artifact,
    )
    __all__.extend([
        "fit_transform_preprocessor",
        "participant_level_split",
        "validate_feature_schema",
        "version_dataset_artifact",
    ])
except ImportError:
    pass
