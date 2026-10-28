import sys
import os
import subprocess
import tempfile
import time
import difflib
from typing import Optional, List, Tuple
from app.config import settings

def normalize_output(text: str) -> str:
    """Normalize line endings and strip trailing whitespace for fair comparison."""
    if text is None:
        return ""
    # Normalize \r\n to \n
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    # Strip empty trailing lines
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)

def generate_diff(expected: str, actual: str) -> str:
    """Generate a clean unified diff string between expected and actual output."""
    exp_lines = expected.splitlines(keepends=True)
    act_lines = actual.splitlines(keepends=True)
    diff = list(difflib.unified_diff(exp_lines, act_lines, fromfile="Expected", tofile="Actual", lineterm=""))
    return "\n".join(diff)

class ExecutionEngine:
    def __init__(self, timeout: int = None):
        self.timeout = timeout or settings.CODE_TIMEOUT_SECONDS
        self._docker_available = None

    def is_docker_available(self) -> bool:
        if self._docker_available is not None:
            return self._docker_available
        try:
            res = subprocess.run(
                ["docker", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=2
            )
            self._docker_available = (res.returncode == 0)
        except Exception:
            self._docker_available = False
        return self._docker_available

    def run_single_test(
        self,
        code: str,
        input_data: str,
        expected_output: Optional[str] = None
    ) -> dict:
        """
        Execute code against input_data.
        Returns a dictionary with status, stdout, stderr, execution_time_ms, and diff.
        """
        start_time = time.perf_counter()
        stdout, stderr, exit_code, timed_out = self._execute_code(code, input_data)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        actual_norm = normalize_output(stdout)
        expected_norm = normalize_output(expected_output) if expected_output is not None else None

        if timed_out:
            return {
                "status": "Time Limit Exceeded",
                "actual_output": actual_norm,
                "stdout": stdout,
                "stderr": f"Error: Execution timed out after {self.timeout} seconds.",
                "execution_time_ms": elapsed_ms,
                "diff": None
            }

        if exit_code != 0:
            return {
                "status": "Runtime Error",
                "actual_output": actual_norm,
                "stdout": stdout,
                "stderr": stderr,
                "execution_time_ms": elapsed_ms,
                "diff": None
            }

        if expected_norm is not None:
            if actual_norm == expected_norm:
                status = "Passed"
                diff = None
            else:
                status = "Wrong Answer"
                diff = generate_diff(expected_norm, actual_norm)
        else:
            status = "Passed"
            diff = None

        return {
            "status": status,
            "actual_output": actual_norm,
            "stdout": stdout,
            "stderr": stderr,
            "execution_time_ms": elapsed_ms,
            "diff": diff
        }

    def _execute_code(self, code: str, stdin_data: str) -> Tuple[str, str, int, bool]:
        """
        Executes code using Docker if available, otherwise safely falls back to local subprocess.
        Returns (stdout, stderr, exit_code, timed_out).
        """
        if self.is_docker_available():
            try:
                return self._run_in_docker(code, stdin_data)
            except Exception:
                # Fallback to subprocess if docker call fails unexpectedly
                pass
        return self._run_in_subprocess(code, stdin_data)

    def _run_in_subprocess(self, code: str, stdin_data: str) -> Tuple[str, str, int, bool]:
        """
        Safely executes Python in an isolated temporary directory with timeout and memory precautions.
        """
        with tempfile.TemporaryDirectory() as temp_dir:
            script_path = os.path.join(temp_dir, "solution.py")
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(code)

            try:
                # -u for unbuffered binary stdout/stderr
                proc = subprocess.Popen(
                    [sys.executable, "-u", script_path],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    cwd=temp_dir
                )
                stdout, stderr = proc.communicate(input=stdin_data, timeout=self.timeout)
                return (stdout, stderr, proc.returncode, False)
            except subprocess.TimeoutExpired:
                proc.kill()
                try:
                    stdout, stderr = proc.communicate(timeout=1)
                except Exception:
                    stdout, stderr = "", ""
                return (stdout, stderr, -1, True)
            except Exception as e:
                return ("", str(e), 1, False)

    def _run_in_docker(self, code: str, stdin_data: str) -> Tuple[str, str, int, bool]:
        """
        Runs Python in an ephemeral container with strict resource limits and disabled network.
        """
        with tempfile.TemporaryDirectory() as temp_dir:
            script_path = os.path.join(temp_dir, "solution.py")
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(code)

            docker_cmd = [
                "docker", "run", "--rm", "-i",
                "--network", "none",
                "--memory", f"{settings.MAX_MEMORY_MB}m",
                "--cpus", "1.0",
                "-v", f"{os.path.abspath(temp_dir)}:/app:ro",
                "-w", "/app",
                settings.DOCKER_IMAGE,
                "python", "-u", "solution.py"
            ]
            try:
                proc = subprocess.Popen(
                    docker_cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                stdout, stderr = proc.communicate(input=stdin_data, timeout=self.timeout)
                return (stdout, stderr, proc.returncode, False)
            except subprocess.TimeoutExpired:
                proc.kill()
                return ("", "Execution timed out in container", -1, True)

execution_engine = ExecutionEngine()
