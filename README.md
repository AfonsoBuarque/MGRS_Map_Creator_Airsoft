# Task Force MGRS Mapper v2.0.0

🎯 **Aplicação web profissional para conversão de coordenadas MGRS para operações táticas de airsoft**

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.7+-green.svg)
![Flask](https://img.shields.io/badge/flask-3.0.3-red.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

## 🚀 Funcionalidades

### ✨ Funcionalidades Principais
- **Conversão MGRS → WGS84**: Conversão precisa de coordenadas militares
- **Mapa Interativo**: Visualização com Leaflet.js e OpenStreetMap
- **Categorização**: Organize pontos por categoria com cores personalizáveis
- **Validação Avançada**: Validação robusta de formato MGRS
- **Notificações**: Sistema de feedback visual para o usuário

### 📁 Import/Export
- **Importação**: Suporte para arquivos CSV e GeoJSON
- **Exportação**: Múltiplos formatos (KML, GeoJSON, CSV)
- **Rotas**: Conecte pontos com rotas táticas no KML

### 💾 Gerenciamento de Sessões
- **Salvar Sessões**: Persista seu trabalho no navegador
- **Carregar Sessões**: Restaure sessões salvas
- **Atalhos**: Ctrl+S para salvar rapidamente

### 🔍 Busca e Filtros
- **Busca por Nome**: Encontre pontos específicos
- **Filtro por Categoria**: Visualize apenas categorias selecionadas
- **Busca em Tempo Real**: Resultados instantâneos

### ⚡ Ações Rápidas
- **Undo/Redo**: Ctrl+Z/Ctrl+Y para desfazer/refazer
- **Edição de Pontos**: Edite diretamente nos popups
- **Limpeza Rápida**: Remova todos os pontos com confirmação

### 🌙 Temas
- **Modo Escuro/Claro**: Alternância automática ou manual
- **Persistência**: Lembra da preferência do usuário
- **Design Responsivo**: Funciona em desktop e mobile

## 🛠️ Instalação

### Pré-requisitos
- Python 3.7+
- pip

### Passos
1. **Clone o repositório**
   ```bash
   git clone <repository-url>
   cd Mapa
   ```

2. **Crie um ambiente virtual**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   # ou
   source .venv/bin/activate  # Linux/Mac
   ```

3. **Instale as dependências**
   ```bash
   pip install -r requirements.txt
   ```

4. **Execute a aplicação**
   ```bash
   python app.py
   ```

5. **Acesse no navegador**
   ```
   http://localhost:8000
   ```

## 📖 Como Usar

### Adicionando Pontos
1. Preencha o formulário "Adicionar Ponto"
2. **Nome**: Identificação do ponto (ex: "Parte 1")
3. **MGRS**: Coordenada no formato 23KKP4014597230
4. **Categoria**: Tipo do ponto (Parte, Antígeno, Base, etc.)
5. **Cor**: Cor do marcador no mapa

### Formatos MGRS Suportados
- **Formato Completo**: 23KKP4014597230
- **Com Espaços**: 23K KP 40145 97230
- **Precisão Variável**: 23KKP401972 (menor precisão)

### Importando Dados

#### CSV
```csv
name,mgrs,category,latitude,longitude,color
"Parte 1","23KKP4014597230","Parte",-23.550520,-46.633308,"#ff0000"
"Base Alpha","23KKP4114597330","Base",-23.540520,-46.623308,"#00ff00"
```

#### GeoJSON
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Parte 1",
        "mgrs": "23KKP4014597230",
        "category": "Parte",
        "color": "#ff0000"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-46.633308, -23.550520]
      }
    }
  ]
}
```

### Atalhos do Teclado
- **Ctrl+Z**: Desfazer última ação
- **Ctrl+Y**: Refazer ação
- **Ctrl+S**: Salvar sessão atual

## 🏗️ Arquitetura

### Backend (Flask)
- **app.py**: Servidor principal com API REST
- **Validação MGRS**: Regex avançado para validação
- **Logging**: Sistema de logs para debugging
- **Endpoints**: `/convert`, `/export_kml`, `/health`, `/api/info`

### Frontend
- **Leaflet.js**: Biblioteca de mapas interativos
- **Vanilla JavaScript**: Sem dependências pesadas
- **CSS Grid/Flexbox**: Layout responsivo moderno
- **CSS Variables**: Sistema de temas dinâmico

### Estrutura de Arquivos
```
Mapa/
├── app.py              # Servidor Flask
├── requirements.txt    # Dependências Python
├── README.md          # Documentação
├── static/
│   ├── app.js         # JavaScript principal
│   └── styles.css     # Estilos CSS
└── templates/
    └── index.html     # Template HTML
```

## 🔧 API Endpoints

### POST /convert
Converte coordenadas MGRS para WGS84
```json
{
  "points": [
    {
      "name": "Parte 1",
      "mgrs": "23KKP4014597230",
      "color": "#ff0000",
      "category": "Parte"
    }
  ]
}
```

### POST /export_kml
Exporta pontos para formato KML
```json
{
  "points": [...],
  "connectRoute": true
}
```

### GET /health
Verifica saúde da aplicação

### GET /api/info
Informações da API

## 🎨 Personalização

### Cores Padrão por Categoria
- **Parte**: #ff3b30 (Vermelho)
- **Antígeno**: #ff9500 (Laranja)
- **Base**: #34c759 (Verde)
- **Observação**: #007aff (Azul)

### Temas
- **Claro**: Fundo branco, texto escuro
- **Escuro**: Fundo escuro, texto claro
- **Auto**: Segue preferência do sistema

## 🚀 Funcionalidades Avançadas

### Sistema de Histórico
- Mantém até 50 estados anteriores
- Undo/Redo com validação
- Persistência durante a sessão

### Validação MGRS
- Regex pattern: `^\d{1,2}[C-X][A-Z]{2}\d{1,10}$`
- Validação de zona UTM
- Verificação de coordenadas válidas

### Notificações
- **Sucesso**: Verde para ações bem-sucedidas
- **Erro**: Vermelho para falhas
- **Info**: Azul para informações
- **Aviso**: Amarelo para alertas

## 🔒 Segurança

- Validação de entrada robusta
- Sanitização de dados para KML
- Tratamento de erros abrangente
- Logs de segurança

## 📱 Responsividade

- **Desktop**: Layout de duas colunas
- **Mobile**: Layout empilhado
- **Tablet**: Adaptação automática
- **Touch**: Suporte completo a gestos

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para detalhes.

## 🆘 Suporte

Para suporte técnico ou dúvidas:
- Abra uma issue no GitHub
- Consulte a documentação da API em `/api/info`
- Verifique os logs da aplicação

## 🔄 Changelog

### v2.0.0 (Atual)
- ✨ Sistema de temas claro/escuro
- ✨ Import/export de arquivos
- ✨ Gerenciamento de sessões
- ✨ Busca e filtros avançados
- ✨ Sistema de notificações
- ✨ Undo/Redo com histórico
- ✨ Validação MGRS aprimorada
- ✨ API REST documentada
- ✨ Design responsivo moderno
- ✨ Atalhos de teclado
- ✨ Popups interativos nos marcadores

### v1.0.0
- 🎯 Conversão básica MGRS → WGS84
- 🗺️ Mapa interativo com Leaflet
- 📤 Exportação KML/CSV/GeoJSON
- 🏷️ Sistema de categorias e cores

---

**Desenvolvido para operações táticas de airsoft** 🎯
