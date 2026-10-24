#!/usr/bin/env python3
"""
Lanza un comando como demonio real (doble fork + setsid + fds a /dev/null)
para que sobreviva al ciclo de vida del ejecutor de comandos del sandbox.

Uso: python3 scripts/daemon.py <cwd> <comando> [args...]
Ej.: python3 scripts/daemon.py /home/z/my-project bun run dev
"""
import os
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print("uso: daemon.py <cwd> <cmd> [args...]", file=sys.stderr)
        return 2
    cwd = sys.argv[1]
    cmd = sys.argv[2:]

    pid = os.fork()
    if pid == 0:
        os.setsid()
        pid2 = os.fork()
        if pid2 == 0:
            devnull = os.open("/dev/null", os.O_RDWR)
            os.dup2(devnull, 0)
            os.dup2(devnull, 1)
            os.dup2(devnull, 2)
            os.chdir(cwd)
            os.execvp(cmd[0], cmd)
            os._exit(127)
        os._exit(0)
    os.waitpid(pid, 0)
    print(f"daemonized: {' '.join(cmd)} (cwd={cwd})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
