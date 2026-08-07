from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 10810
    log_level: str = "info"

    model_config = {"env_prefix": "INFERENCE_"}


settings = Settings()
