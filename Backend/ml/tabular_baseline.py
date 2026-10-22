"""Compatibility entry point for the explicit, provenance-gated trainer."""

if __package__:
    from .train_model import main
else:
    from train_model import main


if __name__ == "__main__":
    raise SystemExit(main())
