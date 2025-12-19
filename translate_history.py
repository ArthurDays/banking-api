import subprocess
import os

mapping = {
    "feat: NeoBank API with JWT, Refresh Tokens, Security Hardening, and CI/CD": "func: API NeoBank com JWT, Refresh Tokens, Segurança Reforçada e CI/CD",
    "docs: Update README with correct GitHub username": "docs: Atualizar README com usuário correto do GitHub",
    "docs: Add screenshots and improve README documentation": "docs: Adicionar prints e melhorar documentação do README",
    "feat: Add AI Assistant with Google Gemini integration": "func: Adicionar Assistente IA com integração Google Gemini",
    "fix: Remove all special characters and accents from source files": "fix: Remover caracteres especiais e acentos dos códigos-fonte",
    "feat: NeoBank API with JWT, Refresh Tokens, Security Hardening": "func: API NeoBank com JWT, Refresh Tokens e Segurança Reforçada",
    "Initial commit": "Commit inicial",
    "Correção de condição de corrida na criação de conta e atualização dos testes de autenticação": "Correção de condição de corrida na criação de conta e atualização dos testes de autenticação"
}

def translate(msg):
    msg = msg.strip()
    if msg in mapping:
        return mapping[msg]
    if msg.startswith("feat: "):
        return msg.replace("feat: ", "func: ", 1)
    return msg

try:
    # Get all commits in reverse order (oldest first)
    output = subprocess.check_output(["git", "log", "--reverse", "--format=%H|%s"]).decode("utf-8")
    commits = [line.strip().split("|", 1) for line in output.split("\n") if "|" in line]

    # Clear current state (stash everything first)
    subprocess.run(["git", "add", "."])
    subprocess.run(["git", "stash"])

    # Create a new orphan branch
    subprocess.run(["git", "checkout", "--orphan", "rebuild-history"])
    subprocess.run(["git", "rm", "-rf", "."], capture_output=True)

    for commit_hash, msg in commits:
        new_msg = translate(msg)
        print(f"Processing: {new_msg}")
        
        # Cherry-pick content only
        subprocess.run(["git", "cherry-pick", "-n", commit_hash])
        # Commit with new message
        subprocess.run(["git", "commit", "-m", new_msg])

    # Switch back to main and update it
    subprocess.run(["git", "checkout", "main"])
    subprocess.run(["git", "reset", "--hard", "rebuild-history"])
    subprocess.run(["git", "branch", "-D", "rebuild-history"])
    
    # Push to origin
    subprocess.run(["git", "push", "origin", "main", "--force"])
    
    print("Success: History rebuilt and pushed to origin/main.")

except Exception as e:
    print(f"Error: {e}")
finally:
    # Try to pop stash if anything was stashed
    subprocess.run(["git", "stash", "pop"])
