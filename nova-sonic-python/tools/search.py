"""
Brave Search Tool - Search the web
Uses Brave Search API for reliable, privacy-focused web search
"""
import json
import os
import httpx
from typing import Dict, Any
from bs4 import BeautifulSoup


def get_tool_spec() -> Dict:
    """Get the tool specification for Bedrock"""
    return {
        "toolSpec": {
            "name": "web_search",
            "description": "Search the web using Brave Search to find current information, news, facts, or answers to questions. Use this when you need up-to-date information or when the answer is not in your knowledge base.",
            "inputSchema": {
                "json": json.dumps({
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query or question to look up on the web"
                        }
                    },
                    "required": ["query"]
                })
            }
        }
    }


async def fetch_article_content(url: str) -> str:
    """
    Fetch and extract main content from a webpage
    
    Args:
        url: URL to fetch
        
    Returns:
        Cleaned text content or None
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
                timeout=5.0,
                follow_redirects=True
            )
            
            if response.status_code != 200:
                return None
            
            html = response.text
            soup = BeautifulSoup(html, 'lxml')
            
            # Remove script, style, nav, footer, ads
            for tag in soup(['script', 'style', 'nav', 'footer', 'aside']):
                tag.decompose()
            
            for class_name in ['ad', 'advertisement', 'social-share']:
                for tag in soup.find_all(class_=class_name):
                    tag.decompose()
            
            # Try to find main content area
            content = ''
            content_selectors = [
                'article',
                'main',
                '[role="main"]',
                '.article-content',
                '.post-content',
                '.entry-content',
                '#content',
                '.content'
            ]
            
            for selector in content_selectors:
                element = soup.select_one(selector)
                if element:
                    content = element.get_text()
                    break
            
            # Fallback to body if no main content found
            if not content:
                body = soup.find('body')
                if body:
                    content = body.get_text()
            
            # Clean up whitespace
            content = ' '.join(content.split())
            
            # Limit to first 2000 characters for token efficiency
            if len(content) > 2000:
                content = content[:2000] + '...'
            
            return content
            
    except Exception as e:
        print(f"Failed to fetch article from {url}: {str(e)}")
        return None


async def format_search_results_for_voice(query: str, results: list, ai_summary: str = None) -> str:
    """
    Format search results with AI summary or article content
    
    Args:
        query: Search query
        results: List of search results
        ai_summary: Optional AI-generated summary
        
    Returns:
        Formatted summary string
    """
    if not results:
        return f'No results found for "{query}".'
    
    summary = f'Search Results for "{query}":\n\n'
    
    # If AI summary is available, use it (preferred method)
    if ai_summary:
        summary += f'=== AI-GENERATED SUMMARY ===\n'
        summary += f'{ai_summary}\n\n'
        summary += f'=== SOURCE REFERENCES ===\n'
        for i, result in enumerate(results[:3], 1):
            summary += f'{i}. {result["title"]}\n'
            summary += f'   {result["url"]}\n\n'
    else:
        # Fallback: Fetch article content from top result
        summary += f'Found {len(results)} relevant sources.\n\n'
        
        top_result = results[0]
        summary += f'=== TOP RESULT (Detailed Analysis) ===\n'
        summary += f'Title: {top_result["title"]}\n'
        summary += f'Source: {top_result["url"]}\n\n'
        
        print(f"Fetching article content from: {top_result['url']}")
        article_content = await fetch_article_content(top_result['url'])
        
        if article_content:
            summary += f'ARTICLE CONTENT:\n{article_content}\n\n'
        else:
            summary += f'SUMMARY: {top_result["snippet"]}\n\n'
        
        # Add other results as references
        if len(results) > 1:
            summary += f'=== ADDITIONAL SOURCES ===\n'
            for i, result in enumerate(results[1:4], 2):
                summary += f'{i}. {result["title"]}\n'
                summary += f'   {result["snippet"]}\n'
                summary += f'   {result["url"]}\n\n'
    
    if len(results) > 4:
        summary += f'Plus {len(results) - 4} more sources available.\n'
    
    return summary


async def fetch_brave_summary(summary_key: str, api_key: str) -> str:
    """
    Fetch AI-generated summary from Brave Summarizer API
    
    Args:
        summary_key: Summary key from search response
        api_key: Brave API key
        
    Returns:
        AI summary text or None
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.search.brave.com/res/v1/summarizer/search",
                params={
                    "key": summary_key,
                    "entity_info": "1"
                },
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": api_key
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                print(f"Brave Summarizer API error ({response.status_code})")
                return None
            
            data = response.json()
            
            # Extract summary text
            if data.get("summary") and len(data["summary"]) > 0:
                return data["summary"][0].get("data")
            
            return None
            
    except Exception as e:
        print(f"Failed to fetch Brave summary: {str(e)}")
        return None


async def execute(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute the search tool
    
    Args:
        params: Dictionary with 'query' key
        
    Returns:
        Search results dictionary
    """
    query = params.get("query")
    
    if not query:
        return {"error": "Query parameter is required"}
    
    # Validate API key
    api_key = os.getenv("BRAVE_SEARCH_API_KEY")
    if not api_key:
        return {
            "error": "Search API key not configured. Please set BRAVE_SEARCH_API_KEY in .env file."
        }
    
    try:
        async with httpx.AsyncClient() as client:
            # Build API URL with query parameters
            response = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={
                    "q": query,
                    "count": 5,
                    "safesearch": "moderate",
                    "text_decorations": "false",
                    "summary": "1"
                },
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": api_key
                },
                timeout=15.0
            )
            
            if response.status_code != 200:
                error_text = response.text
                print(f"Brave Search API error ({response.status_code}): {error_text}")
                
                if response.status_code == 401:
                    return {"error": "Invalid API key. Please check BRAVE_SEARCH_API_KEY in .env file."}
                elif response.status_code == 429:
                    return {"error": "Rate limit exceeded. Please try again later."}
                
                return {"error": f"Search failed with status: {response.status_code}"}
            
            data = response.json()
            
            # Extract web results
            web_results = data.get("web", {}).get("results", [])
            
            if not web_results:
                return {
                    "query": query,
                    "message": "No search results found.",
                    "suggestion": "Try rephrasing the query or using different keywords."
                }
            
            # Check if AI summary is available (only in paid plans)
            ai_summary = None
            if data.get("summarizer") and data["summarizer"].get("key"):
                print("Fetching AI summary...")
                ai_summary = await fetch_brave_summary(data["summarizer"]["key"], api_key)
            
            # Format results in a concise, voice-friendly format
            results = []
            for result in web_results:
                results.append({
                    "title": result.get("title", "No title"),
                    "url": result.get("url", ""),
                    "snippet": result.get("description", "No description available")
                })
            
            # Create a natural language summary for voice output
            summary = await format_search_results_for_voice(query, results, ai_summary)
            
            return {
                "query": query,
                "summary": summary,
                "resultCount": len(results),
                "topResults": [
                    {"title": r["title"], "url": r["url"]}
                    for r in results[:3]
                ]
            }
            
    except httpx.TimeoutException:
        return {"error": f"Request timeout while searching for: {query}"}
    except httpx.RequestError as e:
        return {"error": f"Network error: {str(e)}"}
    except Exception as e:
        return {"error": f"Failed to perform web search: {str(e)}"}
