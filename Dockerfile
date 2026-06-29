FROM python:3.11-slim

# Set working directory
WORKDIR /code

# Set PYTHONPATH to include the backend directory for internal imports
ENV PYTHONPATH=/code/backend

# Copy requirements
COPY ./requirements.txt /code/requirements.txt

# Install dependencies
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy all project files
COPY . /code

# Run FastAPI on port 7860 (default Hugging Face Spaces port)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
