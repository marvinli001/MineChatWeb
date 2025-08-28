"""
Web Search Service for OpenAI Web Search Integration
支持新版 web_search_preview 和旧版回退机制
"""
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class WebSearchService:
    def __init__(self):
        # 支持新版 web_search 工具的模型列表（根据 openai-web-search.md）
        self.supported_models = [
            'gpt-4o-mini',
            'gpt-4o',
            'gpt-4.1-mini',
            'gpt-4.1',
            'o4-mini',
            'o3',
            'gpt-5'  # with reasoning levels low, medium and high
        ]
        
    def supports_native_web_search(self, provider: str, model: str) -> bool:
        """
        判断指定模型是否支持新版 web_search 工具
        基于 openai-web-search.md 中的兼容型号说明
        """
        if provider != 'openai':
            return False
            
        # 检查是否在支持列表中
        return any(supported_model in model for supported_model in self.supported_models)
    
    def build_web_search_tool_config(self, tool_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据工具配置构建 web_search 或 web_search_preview 配置
        """
        # 从工具配置中获取工具类型，默认为 web_search_preview
        tool_type = tool_config.get('type', 'web_search_preview')
        
        config = {
            "type": tool_type
        }
        
        # 添加用户位置信息
        if tool_config.get('user_location'):
            config['user_location'] = tool_config['user_location']
            
        # 添加搜索上下文大小
        if tool_config.get('search_context_size'):
            config['search_context_size'] = tool_config['search_context_size']
            
        return config
    
    def extract_citations_from_response(self, response_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        从 OpenAI 响应中提取引用信息
        支持新版 Responses API 格式
        """
        citations = []
        
        try:
            # 新版 Responses API 格式：检查 output 数组
            if 'output' in response_data and isinstance(response_data['output'], list):
                for item in response_data['output']:
                    if item.get('type') == 'message' and 'content' in item:
                        content_list = item['content']
                        if isinstance(content_list, list):
                            for content in content_list:
                                if content.get('type') == 'output_text' and 'annotations' in content:
                                    for annotation in content['annotations']:
                                        if annotation.get('type') == 'url_citation':
                                            citations.append({
                                                'start_index': annotation.get('start_index'),
                                                'end_index': annotation.get('end_index'),
                                                'url': annotation.get('url'),
                                                'title': annotation.get('title', '')
                                            })
            
            # 旧版格式：检查 choices
            elif 'choices' in response_data and response_data['choices']:
                choice = response_data['choices'][0]
                if 'message' in choice and 'content' in choice['message']:
                    message = choice['message']
                    if isinstance(message['content'], list):
                        for content in message['content']:
                            if 'annotations' in content:
                                for annotation in content['annotations']:
                                    if annotation.get('type') == 'url_citation':
                                        citations.append({
                                            'start_index': annotation.get('start_index'),
                                            'end_index': annotation.get('end_index'),
                                            'url': annotation.get('url'),
                                            'title': annotation.get('title', '')
                                        })
                    elif 'annotations' in message:
                        for annotation in message['annotations']:
                            if annotation.get('type') == 'url_citation':
                                citations.append({
                                    'start_index': annotation.get('start_index'),
                                    'end_index': annotation.get('end_index'),
                                    'url': annotation.get('url'),
                                    'title': annotation.get('title', '')
                                })
                                
        except Exception as e:
            logger.warning(f"提取引用信息时出错: {e}")
            
        return citations
    
    def extract_sources_from_response(self, response_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        提取搜索来源信息
        支持新版和旧版响应格式
        """
        sources = []
        
        try:
            # 新版 Responses API 格式：检查 output 数组
            if 'output' in response_data and isinstance(response_data['output'], list):
                for item in response_data['output']:
                    if item.get('type') == 'web_search_call':
                        # 从搜索调用的action中提取来源
                        if 'action' in item and 'sources' in item['action']:
                            for source in item['action']['sources']:
                                sources.append(self._format_source(source))
                        # 检查是否有直接的sources字段
                        elif 'sources' in item:
                            for source in item['sources']:
                                sources.append(self._format_source(source))
            
            # 旧版格式：检查直接的 sources 字段
            if 'sources' in response_data and isinstance(response_data['sources'], list):
                for source in response_data['sources']:
                    sources.append(self._format_source(source))
            
            # 如果还没有找到来源，尝试从引用中提取
            if not sources:
                citations = self.extract_citations_from_response(response_data)
                for citation in citations:
                    if citation.get('url'):
                        sources.append({
                            'url': citation['url'],
                            'title': citation.get('title', self._extract_domain(citation['url'])),
                            'domain': self._extract_domain(citation['url']),
                            'snippet': ''
                        })
                        
        except Exception as e:
            logger.warning(f"提取搜索来源时出错: {e}")
            
        # 去重
        seen_urls = set()
        unique_sources = []
        for source in sources:
            if source['url'] not in seen_urls:
                seen_urls.add(source['url'])
                unique_sources.append(source)
                
        return unique_sources
    
    def _format_source(self, source: Dict[str, Any]) -> Dict[str, Any]:
        """格式化单个来源信息"""
        return {
            'url': source.get('url', ''),
            'title': source.get('title', '') or self._extract_domain(source.get('url', '')),
            'domain': self._extract_domain(source.get('url', '')),
            'snippet': source.get('snippet', '') or source.get('description', '')
        }
    
    def _extract_domain(self, url: str) -> str:
        """从URL中提取域名"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except:
            return ''
    
    def format_web_search_error(self, error: Any) -> Dict[str, Any]:
        """
        格式化搜索错误为语义化JSON
        """
        if isinstance(error, dict) and 'code' in error:
            return {
                'code': error.get('code', 'SEARCH_ERROR'),
                'message': error.get('message', '网络搜索失败'),
                'details': error.get('details')
            }
        elif hasattr(error, 'response') and hasattr(error.response, 'json'):
            try:
                error_data = error.response.json()
                return {
                    'code': error_data.get('code', 'API_ERROR'),
                    'message': error_data.get('message', '网络搜索API调用失败'),
                    'details': error_data.get('details')
                }
            except:
                pass
        
        return {
            'code': 'UNKNOWN_ERROR',
            'message': str(error) if error else '网络搜索出现未知错误'
        }