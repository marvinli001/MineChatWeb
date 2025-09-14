import json
import logging
import httpx
from typing import Dict, List, Any, Optional
import asyncio

logger = logging.getLogger(__name__)

class PluginExecutor:
    """插件执行器 - 处理Function Call和MCP服务器调用"""

    def __init__(self):
        self.http_timeout = 30  # HTTP请求超时时间
        self.max_retries = 2   # 最大重试次数

    async def execute_function_call(
        self,
        function_name: str,
        function_arguments: Dict[str, Any],
        plugin_definition: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        执行自定义函数调用

        Args:
            function_name: 函数名称
            function_arguments: 函数参数
            plugin_definition: 插件定义（包含执行逻辑）

        Returns:
            函数执行结果
        """
        try:
            logger.info(f"执行自定义函数调用: {function_name}")

            # 这里是自定义插件的执行逻辑
            # 在实际实现中，你可能需要：
            # 1. 根据插件定义执行不同的逻辑
            # 2. 调用外部API
            # 3. 执行本地计算
            # 4. 访问数据库等

            # 示例：简单的内置函数
            if function_name == "get_current_time":
                from datetime import datetime
                return {
                    "success": True,
                    "result": {
                        "current_time": datetime.now().isoformat(),
                        "timezone": "UTC"
                    }
                }

            elif function_name == "calculate":
                # 示例计算函数
                operation = function_arguments.get("operation")
                a = function_arguments.get("a", 0)
                b = function_arguments.get("b", 0)

                if operation == "add":
                    result = a + b
                elif operation == "subtract":
                    result = a - b
                elif operation == "multiply":
                    result = a * b
                elif operation == "divide":
                    if b == 0:
                        return {
                            "success": False,
                            "error": "Division by zero is not allowed"
                        }
                    result = a / b
                else:
                    return {
                        "success": False,
                        "error": f"Unsupported operation: {operation}"
                    }

                return {
                    "success": True,
                    "result": {
                        "operation": operation,
                        "a": a,
                        "b": b,
                        "result": result
                    }
                }

            elif function_name == "get_weather":
                # 示例天气查询函数
                location = function_arguments.get("location", "Unknown")
                return {
                    "success": True,
                    "result": {
                        "location": location,
                        "temperature": "22°C",
                        "condition": "Sunny",
                        "humidity": "65%",
                        "note": "This is a mock weather response. In a real implementation, you would call a weather API."
                    }
                }

            else:
                # 未知函数
                return {
                    "success": False,
                    "error": f"Unknown function: {function_name}",
                    "available_functions": [
                        "get_current_time",
                        "calculate",
                        "get_weather"
                    ]
                }

        except Exception as e:
            logger.error(f"执行函数调用失败: {function_name}, 错误: {str(e)}")
            return {
                "success": False,
                "error": f"Function execution failed: {str(e)}"
            }

    async def call_mcp_server(
        self,
        server_url: str,
        server_name: str,
        method: str,
        params: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        调用MCP服务器

        Args:
            server_url: MCP服务器URL
            server_name: 服务器名称
            method: 调用方法
            params: 调用参数

        Returns:
            MCP服务器响应
        """
        try:
            logger.info(f"调用MCP服务器: {server_name} at {server_url}")

            # 构建MCP请求
            mcp_request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": method,
                "params": params or {}
            }

            # 发送HTTP请求到MCP服务器
            async with httpx.AsyncClient(timeout=self.http_timeout) as client:
                response = await client.post(
                    server_url,
                    json=mcp_request,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "MineChatWeb-MCP-Client/1.0"
                    }
                )

                if response.status_code == 200:
                    mcp_response = response.json()

                    # 检查MCP响应格式
                    if "error" in mcp_response:
                        return {
                            "success": False,
                            "error": f"MCP服务器错误: {mcp_response['error']}"
                        }

                    return {
                        "success": True,
                        "result": mcp_response.get("result", {}),
                        "server_name": server_name
                    }
                else:
                    return {
                        "success": False,
                        "error": f"MCP服务器响应错误: HTTP {response.status_code}"
                    }

        except httpx.TimeoutException:
            logger.error(f"MCP服务器调用超时: {server_name}")
            return {
                "success": False,
                "error": f"MCP服务器 {server_name} 调用超时"
            }
        except Exception as e:
            logger.error(f"MCP服务器调用失败: {server_name}, 错误: {str(e)}")
            return {
                "success": False,
                "error": f"MCP服务器调用失败: {str(e)}"
            }

    async def process_tool_calls(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        处理多个工具调用

        Args:
            tool_calls: 工具调用列表

        Returns:
            工具调用结果列表
        """
        results = []

        for tool_call in tool_calls:
            tool_type = tool_call.get("type")
            call_id = tool_call.get("call_id", "")

            try:
                if tool_type == "function":
                    # 处理函数调用
                    function_name = tool_call.get("function", {}).get("name", "")
                    function_arguments = json.loads(tool_call.get("function", {}).get("arguments", "{}"))

                    result = await self.execute_function_call(
                        function_name=function_name,
                        function_arguments=function_arguments
                    )

                    results.append({
                        "call_id": call_id,
                        "type": "function",
                        "function_name": function_name,
                        "result": result
                    })

                elif tool_type == "mcp_server":
                    # 处理MCP服务器调用
                    server_url = tool_call.get("server_url", "")
                    server_name = tool_call.get("server_name", "")
                    method = tool_call.get("method", "tools/call")
                    params = tool_call.get("params", {})

                    result = await self.call_mcp_server(
                        server_url=server_url,
                        server_name=server_name,
                        method=method,
                        params=params
                    )

                    results.append({
                        "call_id": call_id,
                        "type": "mcp_server",
                        "server_name": server_name,
                        "result": result
                    })

                else:
                    # 未知工具类型
                    results.append({
                        "call_id": call_id,
                        "type": tool_type,
                        "result": {
                            "success": False,
                            "error": f"Unsupported tool type: {tool_type}"
                        }
                    })

            except Exception as e:
                logger.error(f"处理工具调用失败: {tool_call}, 错误: {str(e)}")
                results.append({
                    "call_id": call_id,
                    "type": tool_type,
                    "result": {
                        "success": False,
                        "error": f"Tool call processing failed: {str(e)}"
                    }
                })

        return results

    def format_tool_result_for_ai(self, tool_result: Dict[str, Any]) -> str:
        """
        将工具执行结果格式化为AI可理解的文本

        Args:
            tool_result: 工具执行结果

        Returns:
            格式化后的文本
        """
        try:
            if tool_result.get("success"):
                result_data = tool_result.get("result", {})

                # 根据不同的工具类型格式化结果
                if isinstance(result_data, dict):
                    formatted_parts = []
                    for key, value in result_data.items():
                        formatted_parts.append(f"{key}: {value}")
                    return "\n".join(formatted_parts)
                else:
                    return str(result_data)
            else:
                error_msg = tool_result.get("error", "Unknown error")
                return f"错误: {error_msg}"

        except Exception as e:
            return f"格式化工具结果失败: {str(e)}"