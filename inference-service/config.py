from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 10810
    log_level: str = "info"

    # Timer-XL / Sundial model params
    lstm_hidden_size: int = 64
    lstm_num_layers: int = 2
    transformer_d_model: int = 64
    transformer_nhead: int = 4
    transformer_num_layers: int = 2

    model_config = {"env_prefix": "INFERENCE_"}


settings = Settings()
