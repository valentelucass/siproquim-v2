# Banco local

Ao iniciar pelo diretório `backend/java`, o backend cria `mapas.sqlite` nesta pasta da raiz da V2. O arquivo contém lotes, PDFs, TXTs exportados, correções, evidências e protocolos informados pela operação. O token local de acesso à API também é privado. Os arquivos operacionais são excluídos do Git. Use `SIPROQUIM_DADOS` para configurar outro diretório. Em uma instalação que sincroniza arquivos pelo OneDrive, mantenha um único processo escritor local e use uma cópia consistente do SQLite para transferir dados entre máquinas. Os testes de integração usam diretórios temporários próprios.
`%LOCALAPPDATA%\Rodogarcia\Siproquim\database` é o diretório usado pelo aplicativo instalado. Os arquivos do programa e suas versões ficam separados dessa pasta.
