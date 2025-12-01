import openai
import httpx
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import time
import uuid
import tempfile
import os
from ..models.deep_research import (
    DeepResearchTask, 
    DeepResearchRequest, 
    DeepResearchStatus,
    DeepResearchFile,
    DeepResearchClarificationRequest,
    DeepResearchEnhanceRequest
)

logger = logging.getLogger(__name__)

class DeepResearchService:
    def __init__(self):
        self.timeout = 600  # 10分钟超时，适合深度研究的长时间处理
        self.clarification_timeout = 30  # 澄清问题请求的较短超时
        # 内存存储，实际项目中应使用数据库
        self._tasks_storage: Dict[str, DeepResearchTask] = {}
        # WebSocket管理器引用，由API层设置
        self.ws_manager = None

    def set_websocket_manager(self, ws_manager):
        """设置WebSocket管理器"""
        self.ws_manager = ws_manager

    async def notify_task_update(self, task_id: str, task: DeepResearchTask):
        """通过WebSocket通知任务状态更新"""
        if self.ws_manager:
            try:
                message = json.dumps({
                    "type": "task_update",
                    "task_id": task_id,
                    "status": task.status.value if hasattr(task.status, 'value') else task.status,
                    "result": task.result,
                    "warning_message": task.warning_message,
                    "updated_at": datetime.now().isoformat()
                })
                await self.ws_manager.send_task_update(task_id, message)
                logger.info(f"WebSocket任务状态更新已发送: {task_id} -> {task.status}")
            except Exception as e:
                logger.error(f"发送WebSocket通知时出错: {str(e)}")

    async def create_clarification_questions(
        self, 
        query: str, 
        api_key: str, 
        base_url: Optional[str] = None
    ) -> List[str]:
        """
        使用小模型生成澄清问题，以便更好地理解用户意图
        """
        try:
            # 配置OpenAI客户端
            client_config = {
                "api_key": api_key,
                "timeout": httpx.Timeout(self.clarification_timeout)
            }
            if base_url:
                client_config["base_url"] = base_url
            
            client = openai.AsyncOpenAI(**client_config)
            
            # 用于生成澄清问题的系统提示
            clarification_instructions = """
您正在与需要进行深度研究任务的用户对话。您的工作是收集更多信息，以成功完成任务。

指导原则：
- 简洁地收集所有必要信息
- 确保以简洁、结构良好的方式收集完成研究任务所需的所有信息
- 如果适当，使用项目符号或编号列表以确保清晰
- 不要询问不必要的信息或用户已经提供的信息

重要：不要自己进行任何研究，只需收集将提供给研究员进行研究任务的信息。

请针对用户的查询，生成3-5个有助于澄清研究需求的问题。每个问题应该在一行内，以问号结尾。
            """.strip()
            
            response = await client.chat.completions.create(
                model="gpt-4o-mini",  # 使用较快的小模型
                messages=[
                    {"role": "system", "content": clarification_instructions},
                    {"role": "user", "content": f"请为以下研究请求生成澄清问题：{query}"}
                ],
                temperature=0.7
            )
            
            content = response.choices[0].message.content
            if not content:
                return []
            
            # 解析返回的问题列表
            questions = []
            for line in content.strip().split('\n'):
                line = line.strip()
                # 移除序号和格式符号
                if line and ('?' in line or '？' in line):
                    # 清理格式
                    cleaned_line = line
                    # 移除常见的序号格式
                    prefixes_to_remove = ['- ', '* ', '• ']
                    for prefix in prefixes_to_remove:
                        if cleaned_line.startswith(prefix):
                            cleaned_line = cleaned_line[len(prefix):].strip()
                    
                    # 移除数字序号
                    import re
                    cleaned_line = re.sub(r'^\d+[\.\)]\s*', '', cleaned_line).strip()
                    
                    if cleaned_line:
                        questions.append(cleaned_line)
            
            return questions[:5]  # 最多返回5个问题
            
        except Exception as e:
            logger.error(f"生成澄清问题时出错: {str(e)}")
            return []

    async def enhance_query(
        self, 
        query: str, 
        clarifications: Dict[str, str], 
        api_key: str, 
        base_url: Optional[str] = None
    ) -> str:
        """
        基于用户的澄清回答增强原始查询
        """
        try:
            # 配置OpenAI客户端
            client_config = {
                "api_key": api_key,
                "timeout": httpx.Timeout(self.clarification_timeout)
            }
            if base_url:
                client_config["base_url"] = base_url
            
            client = openai.AsyncOpenAI(**client_config)
            
            # 构建澄清信息文本
            clarifications_text = ""
            for question, answer in clarifications.items():
                clarifications_text += f"问题：{question}\n回答：{answer}\n\n"
            
            # 用于增强查询的系统提示
            enhance_instructions = """
您将收到用户的研究任务。您的工作是为将完成该任务的研究员制作一套指导说明。不要自己完成任务，只需提供如何完成任务的指导说明。

指导原则：
1. **最大化具体性和细节**
- 包含所有已知的用户偏好，明确列出要考虑的关键属性或维度
- 至关重要的是，用户提供的所有细节都必须包含在指导说明中

2. **将未声明但必要的维度填写为开放式**
- 如果某些属性对有意义的输出至关重要但用户未提供，明确说明它们是开放式的或默认无特定约束

3. **避免无根据的假设**
- 如果用户未提供特定细节，不要编造一个
- 相反，说明缺乏规范，并指导研究员将其视为灵活的或接受所有可能的选项

4. **使用第一人称**
- 从用户的角度表述请求

5. **表格**
- 如果您确定包含表格将有助于说明、组织或增强研究输出中的信息，必须明确要求研究员提供它们

6. **标题和格式**
- 您应该在提示中包含预期的输出格式
- 如果用户要求的内容最好以结构化格式返回（如报告、计划等），要求研究员格式化为报告，使用适当的标题和格式确保清晰和结构

7. **语言**
- 如果用户输入是中文，告诉研究员用中文回应，除非用户明确要求用不同语言回应

8. **来源**
- 如果应该优先考虑特定来源，请在提示中指定它们
- 对于产品和旅行研究，优先直接链接到官方或主要网站，而不是聚合器网站
- 对于学术或科学查询，优先直接链接到原始论文或官方期刊出版物
- 如果查询是特定语言，优先考虑以该语言发布的来源
            """.strip()
            
            prompt = f"""
原始查询：{query}

用户澄清信息：
{clarifications_text.strip()}

请基于原始查询和用户的澄清信息，生成一个详细、具体的研究指导说明，用于指导深度研究模型完成这项研究任务。
            """.strip()
            
            response = await client.chat.completions.create(
                model="gpt-4o-mini",  # 使用较快的小模型
                messages=[
                    {"role": "system", "content": enhance_instructions},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )
            
            enhanced_query = response.choices[0].message.content
            return enhanced_query or query  # 如果增强失败，返回原始查询
            
        except Exception as e:
            logger.error(f"增强查询时出错: {str(e)}")
            return query  # 出错时返回原始查询

    async def upload_file_and_create_vector_store(
        self, 
        file_content: bytes, 
        filename: str, 
        api_key: str, 
        base_url: Optional[str] = None
    ) -> tuple[str, str]:
        """
        上传文件到OpenAI并创建vector store
        返回 (file_id, vector_store_id)
        """
        try:
            # 配置OpenAI客户端
            client_config = {
                "api_key": api_key,
                "timeout": httpx.Timeout(60)
            }
            if base_url:
                client_config["base_url"] = base_url
            
            client = openai.AsyncOpenAI(**client_config)
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name
            
            try:
                # 上传文件到OpenAI
                with open(temp_file_path, 'rb') as f:
                    file_response = await client.files.create(
                        file=f,
                        purpose='assistants'
                    )
                
                file_id = file_response.id
                logger.info(f"文件上传成功: {file_id}")
                
                # 创建vector store
                vector_store_response = await client.beta.vector_stores.create(
                    name=f"Deep Research - {filename}",
                    file_ids=[file_id]
                )
                
                vector_store_id = vector_store_response.id
                logger.info(f"Vector store创建成功: {vector_store_id}")
                
                return file_id, vector_store_id
                
            finally:
                # 清理临时文件
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"上传文件或创建vector store时出错: {str(e)}")
            raise

    async def create_research_task(self, request: DeepResearchRequest) -> DeepResearchTask:
        """
        创建深度研究任务并启动后台处理
        """
        # 生成任务ID和基本信息
        task_id = str(uuid.uuid4())
        current_time = datetime.now().isoformat()
        
        # 创建任务标题（截取查询的前50个字符）
        title = request.query[:50] + "..." if len(request.query) > 50 else request.query
        
        # 创建任务对象
        task = DeepResearchTask(
            id=task_id,
            title=title,
            query=request.query,
            model=request.model,
            status=DeepResearchStatus.RUNNING,
            created_at=current_time,
            files=request.files
        )
        
        # 存储任务
        self._tasks_storage[task_id] = task

        # 发送初始状态更新
        await self.notify_task_update(task_id, task)

        # 异步启动深度研究处理
        asyncio.create_task(self._process_deep_research_task(task, request))

        return task

    async def _process_deep_research_task(self, task: DeepResearchTask, request: DeepResearchRequest):
        """
        后台处理深度研究任务
        """
        try:
            # 配置OpenAI客户端
            client_config = {
                "api_key": request.api_key,
                "timeout": httpx.Timeout(self.timeout)
            }
            if request.base_url:
                client_config["base_url"] = request.base_url
            
            client = openai.AsyncOpenAI(**client_config)
            
            # 构建工具配置
            tools = []
            
            # 添加网络搜索工具
            if request.enable_web_search:
                tools.append({"type": "web_search"})
            
            # 添加文件搜索工具
            if request.vector_store_ids:
                tools.append({
                    "type": "file_search",
                    "vector_store_ids": request.vector_store_ids[:2]  # 最多2个向量存储
                })
            
            # 添加代码解释器工具
            if request.enable_code_interpreter:
                tools.append({
                    "type": "code_interpreter",
                    "container": {"type": "auto"}
                })
            
            # 如果没有工具，至少添加网络搜索
            if not tools:
                tools.append({"type": "web_search"})
            
            # 构建请求参数
            research_params = {
                "model": request.model,
                "input": request.query,
                "background": True,  # 使用后台模式
                "tools": tools
            }
            
            # 添加最大工具调用次数限制
            if request.max_tool_calls:
                research_params["max_tool_calls"] = request.max_tool_calls
            
            logger.info(f"开始深度研究任务 {task.id}，模型: {request.model}")
            
            # 调用OpenAI深度研究API
            response = await client.responses.create(**research_params)

            # 存储OpenAI响应ID用于后续状态查询
            if hasattr(response, 'id'):
                task.openai_response_id = response.id
                self._tasks_storage[task.id] = task
                logger.info(f"OpenAI响应已创建: {response.id}, 状态: {getattr(response, 'status', 'unknown')}")

            # 检查响应状态并等待完成
            await self._wait_for_response_completion(task, client, response)

            logger.info(f"深度研究任务 {task.id} 完成")
            
        except Exception as e:
            logger.error(f"处理深度研究任务 {task.id} 时出错: {str(e)}")
            # 更新任务状态为失败
            task.status = DeepResearchStatus.FAILED
            task.result = f"研究过程中发生错误: {str(e)}"
            self._tasks_storage[task.id] = task
            await self.notify_task_update(task.id, task)

    async def _wait_for_response_completion(self, task: DeepResearchTask, client, initial_response):
        """
        等待OpenAI深度研究响应完成并处理结果
        """
        response = initial_response
        max_retries = 120  # 增加最大重试次数，每次间隔5秒，总共10分钟
        retry_count = 0

        while retry_count < max_retries:
            try:
                # 检查响应状态
                if hasattr(response, 'status'):
                    status = response.status
                    logger.info(f"任务 {task.id} 响应状态: {status}, 重试次数: {retry_count}")

                    if status == 'completed':
                        # 响应已完成，提取结果
                        result_text = self._extract_research_result(response)

                        # 检查结果是否有效
                        if result_text is not None:
                            # 检查是否需要澄清
                            if self._needs_clarification(response):
                                task.status = DeepResearchStatus.WARNING
                                task.warning_message = "研究需要更多信息才能提供准确结果，建议提供更详细的查询或使用澄清功能。"
                            else:
                                task.status = DeepResearchStatus.COMPLETED

                            task.result = result_text
                            self._tasks_storage[task.id] = task
                            await self.notify_task_update(task.id, task)
                            return
                        else:
                            # result_text为None表示仍在处理中，继续等待
                            logger.info(f"任务 {task.id} 状态为completed但结果提取返回None，继续等待")
                            await asyncio.sleep(5)
                            retry_count += 1
                            continue

                    elif status in ['failed', 'cancelled']:
                        # 响应失败
                        task.status = DeepResearchStatus.FAILED
                        task.result = f"研究任务失败，OpenAI响应状态: {status}"
                        self._tasks_storage[task.id] = task
                        await self.notify_task_update(task.id, task)
                        return

                    elif status in ['queued', 'in_progress']:
                        # 仍在处理中，等待并重试
                        await asyncio.sleep(5)
                        retry_count += 1

                        # 获取更新的响应状态
                        if hasattr(response, 'id'):
                            try:
                                response = await client.responses.retrieve(response.id)
                                logger.info(f"任务 {task.id} 更新响应状态: {getattr(response, 'status', 'unknown')}")
                            except Exception as e:
                                logger.error(f"获取响应状态时出错: {str(e)}")
                                # 继续使用原响应
                        continue

                    else:
                        # 未知状态，记录并继续等待
                        logger.warning(f"任务 {task.id} 未知响应状态: {status}")
                        await asyncio.sleep(5)
                        retry_count += 1
                        continue

                # 如果没有状态属性，尝试直接提取结果
                result_text = self._extract_research_result(response)
                if result_text is not None and not result_text.startswith("未能从响应中提取到研究结果"):
                    task.status = DeepResearchStatus.COMPLETED
                    task.result = result_text
                    self._tasks_storage[task.id] = task
                    await self.notify_task_update(task.id, task)
                    return

                # 继续等待
                await asyncio.sleep(5)
                retry_count += 1

            except Exception as e:
                logger.error(f"等待响应完成时出错: {str(e)}")
                await asyncio.sleep(5)
                retry_count += 1

        # 超时处理
        logger.warning(f"任务 {task.id} 等待超时，最后尝试提取结果")
        try:
            # 最后一次尝试提取结果
            if hasattr(response, 'id'):
                response = await client.responses.retrieve(response.id)

            result_text = self._extract_research_result(response)
            if result_text:
                task.status = DeepResearchStatus.WARNING
                task.warning_message = "任务处理时间较长，可能部分完成。"
                task.result = result_text
            else:
                task.status = DeepResearchStatus.FAILED
                task.result = "研究任务超时，未能在规定时间内完成。请尝试使用更简洁的查询或稍后重试。"
        except Exception as e:
            logger.error(f"超时后提取结果失败: {str(e)}")
            task.status = DeepResearchStatus.FAILED
            task.result = "研究任务超时，未能在规定时间内完成。请尝试使用更简洁的查询或稍后重试。"

        self._tasks_storage[task.id] = task
        await self.notify_task_update(task.id, task)

    def _needs_clarification(self, response) -> bool:
        """
        检查响应是否表明需要澄清
        """
        try:
            # 检查响应中是否包含澄清请求的关键词
            result_text = self._extract_research_result(response)
            
            # 检查常见的澄清指示词
            clarification_indicators = [
                "需要更多信息",
                "请澄清",
                "不够具体",
                "模糊不清",
                "need more information",
                "please clarify",
                "unclear",
                "ambiguous",
                "需要更详细",
                "不够明确"
            ]
            
            if result_text:
                result_lower = result_text.lower()
                for indicator in clarification_indicators:
                    if indicator.lower() in result_lower:
                        return True
            
            # 检查响应长度是否过短（可能表明信息不足）
            if result_text and len(result_text.strip()) < 100:
                return True
                
            return False
        except Exception as e:
            logger.error(f"检查澄清需求时出错: {str(e)}")
            return False

    def _extract_research_result(self, response) -> str:
        """
        从OpenAI响应中提取研究结果
        基于官方文档的响应结构：
        1. 优先检查 response.output_text（官方文档第53行）
        2. 然后检查 response.output 数组中的 message 类型项目
        """
        try:
            # 记录响应结构以供调试
            logger.info(f"尝试提取结果，响应类型: {type(response)}")
            logger.info(f"响应属性: {dir(response)}")

            # 1. 首先检查 output_text 属性（根据官方文档）
            if hasattr(response, 'output_text') and response.output_text:
                if isinstance(response.output_text, str) and response.output_text.strip():
                    logger.info(f"从output_text属性提取到结果: {len(response.output_text)} 字符")
                    return response.output_text.strip()

            # 2. 检查 output 数组中的 message 类型项目（根据官方文档第143-160行）
            if hasattr(response, 'output') and isinstance(response.output, list):
                logger.info(f"响应包含output列表，长度: {len(response.output)}")

                text_parts = []
                for i, item in enumerate(response.output):
                    logger.info(f"Output item {i}: {type(item)} - {item if isinstance(item, dict) else str(item)[:100]}")

                    if isinstance(item, dict):
                        # 查找 message 类型的输出（官方文档结构）
                        if item.get('type') == 'message' and 'content' in item:
                            content = item['content']
                            if isinstance(content, list):
                                # 提取 output_text 类型的内容
                                for part in content:
                                    if isinstance(part, dict) and part.get('type') == 'output_text' and 'text' in part:
                                        text_parts.append(part['text'])
                                        logger.info(f"从message content中提取到output_text: {len(part['text'])} 字符")
                            elif isinstance(content, str):
                                text_parts.append(content)
                                logger.info(f"从message content中提取到字符串: {len(content)} 字符")

                        # 兼容其他可能的文本格式
                        elif 'text' in item and isinstance(item['text'], str):
                            text_parts.append(item['text'])
                        elif 'content' in item and isinstance(item['content'], str):
                            text_parts.append(item['content'])

                    elif isinstance(item, str):
                        text_parts.append(item)

                if text_parts:
                    result = '\n'.join(text_parts).strip()
                    logger.info(f"从output数组提取到结果: {len(result)} 字符")
                    return result

                # 如果output数组为空
                if len(response.output) == 0:
                    logger.warning("output数组为空，可能任务仍在处理中或输出为空")

            # 3. 检查其他常见属性
            for attr in ['text', 'content']:
                if hasattr(response, attr):
                    value = getattr(response, attr)
                    if value and isinstance(value, str) and value.strip():
                        logger.info(f"从属性 {attr} 提取到结果: {len(value)} 字符")
                        return value

            # 4. 检查choices（ChatCompletion风格，用于兼容性）
            if hasattr(response, 'choices') and response.choices:
                for choice in response.choices:
                    if hasattr(choice, 'message') and hasattr(choice.message, 'content'):
                        if choice.message.content:
                            logger.info(f"从choices提取到结果: {len(choice.message.content)} 字符")
                            return choice.message.content

            # 5. 如果响应状态为completed但没有结果
            if hasattr(response, 'status'):
                logger.info(f"响应状态: {response.status}")
                if response.status == 'completed':
                    return "深度研究任务已完成，但返回的结果为空。这可能是因为：\n1. 查询内容过于简单或模糊\n2. 没有找到相关信息\n3. OpenAI模型响应格式发生变化\n\n建议：请尝试使用更具体、更详细的研究问题重新提交。"
                elif response.status in ['queued', 'in_progress']:
                    return None  # 返回None表示仍在处理中
                elif response.status in ['failed', 'cancelled']:
                    return f"深度研究任务失败，状态: {response.status}"

            # 6. 记录完整响应用于调试
            response_str = str(response)
            logger.warning(f"无法提取结果，完整响应: {response_str[:1000]}...")

            return "未能从响应中提取到研究结果。请检查查询内容是否足够具体，或稍后重试。"

        except Exception as e:
            logger.error(f"提取研究结果时出错: {str(e)}", exc_info=True)
            return f"结果提取时出现错误: {str(e)}"

    async def get_task(self, task_id: str) -> Optional[DeepResearchTask]:
        """获取单个研究任务"""
        return self._tasks_storage.get(task_id)

    async def list_tasks(self, limit: int = 50, offset: int = 0) -> List[DeepResearchTask]:
        """获取研究任务列表"""
        tasks = list(self._tasks_storage.values())
        # 按创建时间倒序排序
        tasks.sort(key=lambda x: x.created_at, reverse=True)
        return tasks[offset:offset + limit]

    async def stop_task(self, task_id: str) -> bool:
        """停止研究任务"""
        task = self._tasks_storage.get(task_id)
        if task and task.status in [DeepResearchStatus.RUNNING, DeepResearchStatus.WARNING]:
            task.status = DeepResearchStatus.FAILED
            self._tasks_storage[task_id] = task
            logger.info(f"深度研究任务 {task_id} 已被用户停止")
            return True
        return False

    async def delete_task(self, task_id: str) -> bool:
        """删除研究任务"""
        if task_id in self._tasks_storage:
            del self._tasks_storage[task_id]
            logger.info(f"深度研究任务 {task_id} 已删除")
            return True
        return False